const jwt = require('jsonwebtoken');


class AppBridge {
  constructor({
    developerOAuth,
    tokenStore,
    whiteListedReturnToHosts = [
      '*.shoplinestg.com',
      '*.shoplineapp.com',
    ],
  } = {}) {
    this.developerOAuth = developerOAuth;
    this.tokenStore = tokenStore;
    this.config = {
      whiteListedReturnToHosts,
    };
  }

  startAuth() {
    return (req, res) => {
      const params = {
        returnTo: req.query.return_to,
        merchantId: req.query.merchant_id,
      };

      if (!this.verifyWhiteListedReturnToHosts(params.returnTo)) {
        return res.status(400).send('Invalid return_to');
      }

      req.session.afterAuthRedirectTo = params.returnTo || '/';

      return res.redirect(
        this.developerOAuth.constructOAuthAuthorizeUrl({
          merchantId: params.merchantId,
        }),
      );
    };
  }

  /**
   * populates:
   *   res.locals.performerId
   *   res.locals.currentMerchantId
   *   res.locals.performerMerchantIds
   *   res.locals.currentToken
   */
  authenticate({
    requireAccessToken = false,
  } = {}) {
    return async (req, res, next) => {
      if (!req.headers['x-shopline-session-token']) {
        return next.length !== 3 ? res.sendStatus(401) : next();
      }

      try {
        // get merchant id and staff id from session token
        // get token from token db
        // refresh token if expired
        const { merchantId, performerId } = this.verifySessionToken(req);

        let accessibleMerchantIds = [];
        let currentToken;

        if (requireAccessToken) {
          const tokenData = await this.getOrRefreshToken(this.developerOAuth.config.client_id, merchantId, performerId);

          if (!tokenData) {
            return res.status(401).json({ message: 'Access Token Not Found' });
          }

          try {
            const tokenInfoRes = await this.developerOAuth.tokenInfo(tokenData.accessToken);

            accessibleMerchantIds = (tokenInfoRes.data.staff || {}).merchant_ids || [];
            currentToken = tokenData.accessToken;
          } catch (err) {
            if (err?.response?.status === 401) {
              return res.status(401).json({
                message: err?.response?.data?.error_description || 'Invalid Token',
                code: err?.response?.data?.code || 'UNKNOWN',
              })
            }

            return next(err);
          }
        }

        res.locals.performerId = performerId;
        res.locals.currentMerchantId = merchantId;
        res.locals.performerMerchantIds = accessibleMerchantIds;
        res.locals.currentToken = currentToken;

        return next();
      } catch (e) {
        return next(e);
      }
    };
  }

  callback() {
    // exchange token
    // store token in session
    // store token in db
    // destroy session
    // redirect to after_auth_return_to
    return [
      async (req, res, next) => this.developerOAuth.callback(req, res, next),
      async (req, res) => {
        const tokenData = req.session.accessTokens.slice(-1)[0];
        await this.tokenStore.save(this.developerOAuth.config.client_id,
          tokenData.merchantId,
          tokenData.performerId,
          tokenData);

        const redirectUrl = req.session && req.session.afterAuthRedirectTo
          ? req.session.afterAuthRedirectTo
          : '/';

        req.session.destroy();

        return res.redirect(redirectUrl);
      },
    ];
  }

  async getOrRefreshToken(clientId, merchantId, performerId) {
    let tokenData = await this.tokenStore.fetch(clientId, merchantId, performerId);

    if (tokenData && this.developerOAuth.isTokenExpired(tokenData)) {
      const oauthRes = await this.developerOAuth.refreshToken(tokenData.accessToken);
      tokenData = this.developerOAuth.constructTokenData(oauthRes, performerId);
      await this.tokenStore.save(clientId, tokenData.merchantId, tokenData.performerId, tokenData);
    }

    return tokenData;
  }

  verifyWhiteListedReturnToHosts(url) {
    return this.config.whiteListedReturnToHosts.some((whitelistHost) => {
      try {
        const { host } = new URL(url);
        if (whitelistHost.startsWith('*.')) {
          return host.endsWith(whitelistHost.replace('*', ''));
        }
        return whitelistHost === host;
      } catch (e) {
        console.error(e);
        return false;
      }
    });
  }

  verifySessionToken(req) {
    const sessionToken = req.headers['x-shopline-session-token'];
    const sessionTokenPayload = this.decodeSessionToken(sessionToken);
    return {
      merchantId: sessionTokenPayload.data.merchant_id,
      performerId: sessionTokenPayload.data.staff_id,
    };
  }

  decodeSessionToken(sessionToken) {
    try {
      const payload = jwt.verify(sessionToken, this.developerOAuth.config.client_secret);
      return payload;
    } catch (e) {
      throw Error('Failed to verify session token');
    }
  }
}

module.exports = AppBridge;

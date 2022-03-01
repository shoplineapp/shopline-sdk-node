const jwt = require('jsonwebtoken');


class AppBridge {
  constructor({
    developerOauth,
    tokenStore,
  } = {}) {
    this.developerOauth = developerOauth;
    this.tokenStore = tokenStore;
  }

  startAuth() {
    return [
      (req, res, next) => {
        req.session.afterAuthRedirectTo = req.query.return_to || '/';
        next();
      },
      async (req, res, next) => this.developerOauth.authenticate(req, res, next),
      (req, res) => {
        // normally, we will never reach this
        res.status(500);
      },
    ];
  }

  /**
   * populates:
   *   res.locals.performerId
   *   res.locals.currentMerchantId
   *   res.locals.performerMerchantId
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

        let performerMerchantIds = [];
        let currentToken;

        if (requireAccessToken) {
          const tokenData = await this.getOrRefreshToken(this.developerOauth.config.client_id, merchantId, performerId);

          if (!tokenData) {
            return res.status(401).json({ message: 'Access Token Not Found' });
          }

          const tokenInfoRes = await this.developerOauth.tokenInfo(tokenData.accessToken);

          performerMerchantIds = (tokenInfoRes.data.staff || {}).merchant_ids || [];
          currentToken = tokenData.accessToken;
        }

        res.locals.performerId = performerId;
        res.locals.currentMerchantId = merchantId;
        res.locals.performerMerchantIds = performerMerchantIds;
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
      async (req, res, next) => this.developerOauth.callback(req, res, next),
      async (req, res) => {
        const tokenData = req.session.accessTokens.slice(-1)[0];
        await this.tokenStore.save(this.developerOauth.config.client_id,
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

    if (tokenData && this.developerOauth.isTokenExpired(tokenData)) {
      const oauthRes = this.developerOauth.refreshToken(tokenData.accessToken);
      tokenData = this.developerOauth.constructTokenData(oauthRes, performerId);
      await this.tokenStore.save(clientId, tokenData.merchantId, tokenData.performerId, tokenData);
    }

    return tokenData;
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
      const payload = jwt.verify(sessionToken, this.developerOauth.config.client_secret);
      return payload;
    } catch (e) {
      throw Error('Failed to verify session token');
    }
  }
}

module.exports = AppBridge;

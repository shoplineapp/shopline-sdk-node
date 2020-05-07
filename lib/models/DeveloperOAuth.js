const axios = require('axios');
const querystring = require('querystring');
const empty = () => {};

class DeveloperOAuth {
  constructor({
    endpoint,
    clientId,
    clientSecret,
    redirectUri,
    scope,
    responseType = 'code',
    logger,
  }) {
    this.apiClient = axios.create({
      baseURL: endpoint,
    });

    this.config = {
      endpoint,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      response_type: responseType,
      scope,
    };

    this.log = logger || empty;
  }

  async exchangeToken(authorizationCode) {
    return this.apiClient.post('oauth/token', {
      ...this.config,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
  }

  async refreshToken(token) {
    return this.apiClient.post('oauth/token', {
      ...this.config,
      refresh_token: token,
      grant_type: 'refresh_token',
    });
  }

  async tokenInfo(token) {
    return this.apiClient.get('oauth/token/info', {
      ...this.config,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  getDefaultMerchantId(req) {
    // any of the session merchants will do, we don't care which merchant it's under
    // use the latest token to prevent outdated ones (there is no token cleanup yet)
    const [token] = (req.session.accessTokens || []).slice(-1);

    this.log('request', 'trace', {
      message:
        'merchantId is not specified, randomly picking a merchant and its access token from session',
    });

    return (token || {}).merchantId;
  }

  async callback(req, res, next) {
    const oauthRes = await this.exchangeToken(req.query.code);

    this.insertTokenToSession(req, {
      merchantId: oauthRes.data.resource_owner_id,
      accessToken: oauthRes.data.access_token,
      refreshToken: oauthRes.data.refresh_token,
      accessTokenExpiresAt: new Date(
        (oauthRes.data.created_at + oauthRes.data.expires_in) * 1000,
      ),
    });

    const redirectUrl =
      req.session && req.session.afterAuthRedirectTo
        ? req.session.afterAuthRedirectTo
        : '/';

    if (req.session && req.session.afterAuthRedirectTo) {
      delete req.session.afterAuthRedirectTo;
    }

    return res.redirect(redirectUrl);
  }

  async authenticate(req, res, next) {
    try {
      if (!this.config) {
        throw new Error('Missing DeveloperOAuth Config');
      }

      const currentMerchantId =
        req.params.merchantId || this.getDefaultMerchantId(req);

      const currentToken = (req.session.accessTokens || []).find(
        (token) => token.merchantId === currentMerchantId,
      );

      if (
        currentToken &&
        currentToken.accessTokenExpiresAt &&
        new Date(currentToken.accessTokenExpiresAt).getTime() < Date.now()
      ) {
        this.log('request', 'trace', {
          message: 'token expired, refreshing token.',
        });
        const oauthRes = await this.refreshToken(currentToken.refreshToken);
        this.updateTokenToSession(req, {
          merchantId: oauthRes.data.resource_owner_id,
          accessToken: oauthRes.data.access_token,
          refreshToken: oauthRes.data.refresh_token,
          accessTokenExpiresAt: new Date(
            (oauthRes.data.created_at + oauthRes.data.expires_in) * 1000,
          ),
        });
      } else {
        const oauthParams = {
          client_id: process.env.DEVELOPER_OAUTH_APP_CLIENT_ID,
          response_type: 'code',
          redirect_uri: process.env.DEVELOPER_OAUTH_APP_REDIRECT_URI,
          scope: process.env.DEVELOPER_OAUTH_APP_SCOPE,
        };

        if (currentMerchantId) {
          oauthParams.merchant_id = currentMerchantId;
        }
        this.log('request', 'trace', {
          message: 'Session not found. Redirecting to DeveloperOAuth',
        });
        return res.redirect(
          `${this.config.endpoint}/oauth/authorize?${querystring.stringify(
            oauthParams,
          )}`,
        );
      }

      const tokenInfo = await this.tokenInfo(currentToken.accessToken);
      res.locals.performerId = (tokenInfo.staff || {})._id;
      res.locals.performerMerchantIds =
        (tokenInfo.staff || {}).merchant_ids || [];
      res.locals.currentToken = currentToken.accessToken;
      res.locals.currentMerchantId = currentMerchantId;

      this.log('request', 'trace', {
        message: 'DeveloperOAuth insert data to res.locals',
        locals: res.locals,
      });
      return next();
    } catch (e) {
      this.log('request', 'error', {
        message: 'OAuth Callback Failed',
      });

      return res.status(401).send('OAuth Token Exchange Failed');
    }
  }

  async insertTokenToSession(req, tokenData) {
    if (!req.session.accessTokens) {
      req.session.accessTokens = [];
    }

    req.session.accessTokens.push(tokenData);

    this.log('request', 'trace', {
      message: 'OAuth Completed and insert token to session',
      tokenData,
    });

    return req.session.accessTokens;
  }

  async updateTokenToSession(req, tokenData) {
    if (!req.session.accessTokens) {
      req.session.accessTokens = [];
    }

    const merchantToken = req.session.accessTokens.find(
      (token) => token.merchantId === tokenData.merchantId,
    );

    if (!merchantToken) {
      return null;
    }

    return Object.assign(merchantToken, tokenData);
  }
}

module.exports = DeveloperOAuth;

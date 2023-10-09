const axios = require('axios');
const querystring = require('querystring');
const {
  ConfigurationError,
  SessionError,
  RefreshTokenError,
  DecodeTokenError,
} = require('../errors');

const empty = () => { };

class DeveloperOAuth {
  constructor({
    endpoint,
    clientId,
    clientSecret,
    redirectUri,
    scope,
    responseType = 'code',
    logger,
    ensureLoginSession = true, // if set to ture, required the app to be under shopline domain.
    errorHandler = {},
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
      ensure_login_session: ensureLoginSession,
      scope,
    };

    this.log = logger || empty;

    this.errorHandler = errorHandler;
  }

  async exchangeToken(authorizationCode) {
    return this.apiClient.post('oauth/token', {
      ...this.config,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
  }

  isTokenExpired(tokenData) {
    return tokenData.accessTokenExpiresAt && new Date(tokenData.accessTokenExpiresAt).getTime() < Date.now();
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

  async currentStaff(cookie) {
    const result = await this.apiClient.request({
      method: 'get',
      url: '/api/staff/current',
      headers: { Cookie: cookie || '' },
    });

    return result.data;
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
    this.log('request', 'trace', {
      message: 'in callback',
      cookie: req.headers.cookie,
    });

    try {
      const currentStaff = await this.currentStaff(req.headers.cookie);
      const prevSession = req.session;
      const currSsoSessionId = (currentStaff || {}).public_session_id_hash;
      this.log('request', 'trace', {
        message: 'callback check session changed',
        "req.session.id": req.session.id,
        reqSessionId: req.sessionId,
      });
      if (this.isSsoSessionChanged(req, currSsoSessionId)) {
        await this.regenerateSession(req);
        req.session.prevSsoSessionId = currSsoSessionId;
        req.session.afterAuthRedirectTo = prevSession.afterAuthRedirectTo;
        this.log('request', 'trace', {
          message: 'callback regened session',
          cookie: req.headers.cookie,
          "req.session.id": req.session.id,
          regenSessionId: req.sessionId,
        });
      }
      const oauthRes = await this.exchangeToken(req.query.code);
      const tokenInfoRes = await this.tokenInfo(oauthRes.data.access_token);
      const performerId = (tokenInfoRes.data.staff || {})._id;
      this.insertTokenToSession(req, this.constructTokenData(oauthRes, performerId));

      const redirectUrl = req.session && req.session.afterAuthRedirectTo
        ? req.session.afterAuthRedirectTo
        : '/';

      this.log('request', 'trace', {
        message: 'get afterAuthRedirectTo',
        afterAuthRedirectTo: req.session.afterAuthRedirectTo,
        redirectUrl: redirectUrl,
      });

      if (req.session && req.session.afterAuthRedirectTo) {
        delete req.session.afterAuthRedirectTo;
        this.log('request', 'trace', {
          message: 'deleted session afterAuthRedirectTo',
        });    
      }

      return res.redirect(redirectUrl);
    } catch (e) {
      this.log('request', 'error', {
        message: 'OAuth callback failed',
        error: e,
      });

      return res.status(401).send({ message: 'OAuth callback failed' });
    }
  }

  async authenticate(req, res, next) {
    this.log('request', 'trace', {
      message: 'in authenticate',
    });

    try {
      if (!this.config) {
        throw new ConfigurationError('Missing DeveloperOAuth Config');
      }

      const currentMerchantId = req.params.merchantId
        || req.params.merchant_id
        || req.query.merchant_id
        || this.getDefaultMerchantId(req);

      let currentToken;
      let currentPerformerId = null;

      if (this.config.ensure_login_session) {
        this.log('request', 'trace', {
          message: 'ensure sso login session',
        });
        const currentStaff = await this.currentStaff(req.headers.cookie);
        currentPerformerId = (currentStaff || {}).id;
        currentToken = (req.session.accessTokens || []).find(
          (token) => token.merchantId === currentMerchantId && token.performerId === currentPerformerId,
        );

        const prevSession = req.session;
        const currSsoSessionId = (currentStaff || {}).public_session_id_hash;
        this.log('request', 'trace', {
          message: 'check session changed',
          "req.session.id": req.session.id,
          reqSessionId: req.sessionId,
        });
        if (this.isSsoSessionChanged(req, currSsoSessionId)) {
          await this.regenerateSession(req);
          req.session.prevSsoSessionId = currSsoSessionId;
          req.session.afterAuthRedirectTo = prevSession.afterAuthRedirectTo;
          this.log('request', 'trace', {
            message: 'redirect to oauth authorize url',
            merchantId: currentMerchantId,
            cookie: req.headers.cookie,
            regenSessionId: req.sessionId,
          });
          return res.redirect(
            this.constructOAuthAuthorizeUrl({
              merchantId: currentMerchantId,
            }),
          );
        }
      } else {
        currentToken = (req.session.accessTokens || []).find((token) => token.merchantId === currentMerchantId);
      }

      res.locals.currentURL = `${req.protocol}://${req.get('host')}${
        req.originalUrl
      }`;

      if (currentToken && this.isTokenExpired(currentToken)) {
        this.log('request', 'trace', {
          message: 'token expired, refreshing token.',
        });
        const oauthRes = await this.refreshToken(currentToken.refreshToken)
          .catch((e) => {
            throw new RefreshTokenError('Staff API Error', { error: e });
          });
        this.updateTokenToSession(req, this.constructTokenData(oauthRes, currentPerformerId));

        return res.redirect(res.locals.currentURL);
      }

      if (!currentToken && !req.xhr) {
        this.log('request', 'trace', {
          message: 'Session not found. Redirecting to DeveloperOAuth',
        });

        req.session.afterAuthRedirectTo = res.locals.currentURL;

        this.log('request', 'trace', {
          message: 'insert afterAuthRedirectTo',
          afterAuthRedirectTo: res.locals.currentURL,
        });

        return res.redirect(
          this.constructOAuthAuthorizeUrl({
            merchantId: currentMerchantId,
          }),
        );
      }

      if (!currentToken && req.xhr) {
        this.log('request', 'error', {
          message: 'Session not found for Ajax call',
        });

        throw new SessionError('Session not found');
      }

      const tokenInfoRes = await this.tokenInfo(currentToken.accessToken)
        .catch((e) => {
          throw new DecodeTokenError('Staff API Error', { error: e });
        });
      res.locals.performerId = (tokenInfoRes.data.staff || {})._id;
      res.locals.performerMerchantIds = (tokenInfoRes.data.staff || {}).merchant_ids || [];
      res.locals.currentToken = currentToken.accessToken;
      res.locals.currentMerchantId = currentMerchantId;

      this.log('request', 'trace', {
        message: 'DeveloperOAuth insert data to res.locals',
        locals: res.locals,
      });

      return next();
    } catch (e) {
      this.log('request', 'error', {
        message: 'OAuth authenticate failed',
        error: e,
      });

      if (e.name && this.errorHandler[e.name]) {
        return this.errorHandler[e.name](req, res, next, e);
      }

      return res.status(401).send('OAuth authenticate failed');
    }
  }

  async validateStaffSession(req, res) {
    if (!res.locals.openApiClient) {
      this.log('request', 'error', {
        message: 'missing openApiClient',
      });

      throw Error('Missing OpenApiClient Config');
    }

    try {
      const { id: staffId } = await res.locals.openApiClient.getStaff(
        res.locals.performerId,
      );

      const { id: ssoId } = await this.currentStaff(req.headers.cookie);

      if (ssoId !== staffId) {
        this.log('request', 'trace', {
          message: 'SSO session mis-matched, calling for Re-authentication',
          staffId,
          ssoId,
        });
        req.session.accessTokens = [];

        return res.status(401).send({
          message: 'Re-authenticate required',
          code: 'REAUTHENTICATE_REQUIRED',
        });
      }

      return staffId;
    } catch (ex) {
      this.log('request', 'error', {
        message:
          'Unable to get current staff session from developer center, giving up',
        reason: ex.message,
      });

      throw Error(
        'Unable to get current staff session from developer center, giving up',
      );
    }
  }

  constructOAuthAuthorizeUrl({ merchantId } = {}) {
    const oauthParams = {
      client_id: this.config.client_id,
      response_type: 'code',
      redirect_uri: this.config.redirect_uri,
      scope: this.config.scope,
    };

    if (merchantId) {
      oauthParams.merchant_id = merchantId;
    }

    return `${this.config.endpoint}/oauth/authorize?${querystring.stringify(oauthParams)}`;
  }

  constructTokenData(oauthRes, performerId) {
    return {
      merchantId: oauthRes.data.resource_owner_id,
      performerId,
      accessToken: oauthRes.data.access_token,
      refreshToken: oauthRes.data.refresh_token,
      accessTokenExpiresAt: new Date(
        (oauthRes.data.created_at + oauthRes.data.expires_in) * 1000,
      ),
    };
  }

  async insertTokenToSession(req, tokenData) {
    if (!req.session.accessTokens) {
      req.session.accessTokens = [];
    }

    req.session.accessTokens.push(tokenData);

    this.log('request', 'trace', {
      message: 'OAuth Completed and insert token to session',
      tokenData,
      session: req.session,
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

  isSsoSessionChanged(req, currSsoSessionId) {
    return req.session.prevSsoSessionId !== currSsoSessionId;
  }

  async regenerateSession(req) {
    this.log('request', 'trace', {
      message: 'session expired, regenerating session.',
    });
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = DeveloperOAuth;

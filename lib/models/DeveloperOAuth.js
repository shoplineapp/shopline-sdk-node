const axios = require('axios');
const querystring = require('querystring');

const empty = () => { };

class DeveloperOAuth {
  constructor({
    endpoint,
    appId,
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

    this.appId = appId;

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
    try {
      const oauthRes = await this.exchangeToken(req.query.code);

      this.upsertTokenToSession(req, {
        merchantId: oauthRes.data.resource_owner_id,
        accessToken: oauthRes.data.access_token,
        refreshToken: oauthRes.data.refresh_token,
        accessTokenExpiresAt: new Date(
          (oauthRes.data.created_at + oauthRes.data.expires_in) * 1000,
        ),
      });

      const redirectUrl = req.session && req.session.afterAuthRedirectTo
        ? req.session.afterAuthRedirectTo
        : '/';

      this.log('request', 'trace', {
        message: 'get afterAuthRedirectTo',
        afterAuthRedirectTo: req.session.afterAuthRedirectTo,
      });

      if (req.session && req.session.afterAuthRedirectTo) {
        delete req.session.afterAuthRedirectTo;
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
    try {
      let tokenInfo;

      if (!this.config) {
        throw new Error('Missing DeveloperOAuth Config');
      }

      const currentMerchantId = req.headers['x-session-merchant-id'] || req.params.merchantId || this.getDefaultMerchantId(req);

      let currentToken = (req.session.accessTokens || []).find(
        (token) => token.merchantId === currentMerchantId,
      );

      // TODO: set endpoint based on env provided by config
      const appProxyBaseUrl = `${req.protocol}://app-proxy.shoplinedev.com:3004/embed/${this.appId}`;

      res.locals.currentURL = `${appProxyBaseUrl}/${req.path}`;

      if (currentToken) {
        tokenInfo = await this.tokenInfo(currentToken.accessToken);
        console.log('token info: ', tokenInfo.data);
      }

      // validate staff
      if (currentToken && req.headers['x-session-staff-id']) {
        const performerId = (tokenInfo.data.staff || {})._id;

        console.log('performers checking: ', performerId, req.headers['x-session-staff-id'])

        if (performerId !== req.headers['x-session-staff-id']) {
          currentToken = null;
        }
      }

      if (
        currentToken
        && currentToken.accessTokenExpiresAt
        && new Date(currentToken.accessTokenExpiresAt).getTime() < Date.now()
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

        return res.redirect(res.locals.currentURL);
      }

      if (!currentToken && !req.xhr) {
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

        req.session.afterAuthRedirectTo = res.locals.currentURL;

        this.log('request', 'trace', {
          message: 'insert afterAuthRedirectTo',
          afterAuthRedirectTo: res.locals.currentURL,
        });

        return res.redirect(
          `${this.config.endpoint}/oauth/authorize?${querystring.stringify(
            oauthParams,
          )}`,
        );
      }

      if (!currentToken && req.xhr) {
        this.log('request', 'error', {
          message: 'Session not found for Ajax call',
        });

        throw new Error('Session not found');
      }

      res.locals.performerId = (tokenInfo.data.staff || {})._id;
      res.locals.performerMerchantIds = (tokenInfo.data.staff || {}).merchant_ids || [];
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

    const sessionStaffId = req.headers['x-session-staff-id'];

    if (!sessionStaffId) {
      return res.locals.performerId;
    }

    try {
      const { id: staffId } = await res.locals.openApiClient.getStaff(
        res.locals.performerId,
      );

      if (sessionStaffId !== staffId) {
        this.log('request', 'trace', {
          message: 'SSO session mis-matched, calling for Re-authentication',
          staffId,
          sessionStaffId,
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

  upsertTokenToSession(req, tokenData) {
    if (!req.session.accessTokens) {
      req.session.accessTokens = [];
    }

    // overwrite token if there's another token with same merchant id
    const upserted = !!this.updateTokenToSession(req, tokenData);

    if (upserted) {
      return req.session.accessTokens;
    }

    req.session.accessTokens.push(tokenData);

    this.log('request', 'trace', {
      message: 'OAuth Completed and insert token to session',
      tokenData,
    });

    return req.session.accessTokens;
  }

  updateTokenToSession(req, tokenData) {
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

const axios = require('axios')
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
      endpoint,
    });

    this.config = {
      endpoint,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      response_type: responseType,
      scope,
    };

    this.log = logger || empty
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

  async authenticate(req, res) {
    try {
      if (!this.config) {
        throw new Error('Missing DeveloperOAuth Config');
      }

      const oauthRes = await this.exchangeToken(req.query.code);

      this.insertSessionToken(req, {
        merchantId: oauthRes.data.resource_owner_id,
        accessToken: oauthRes.data.access_token,
        refreshToken: oauthRes.data.refresh_token,
        accessTokenExpiresAt: new Date(
          (oauthRes.data.created_at + oauthRes.data.expires_in) * 1000,
        ),
      });

      const redirectUrl = req.session && req.session.afterAuthRedirectTo ? req.session.afterAuthRedirectTo : '/';

      if (req.session && req.session.afterAuthRedirectTo) {
        delete req.session.afterAuthRedirectTo;
      }
  
      return res.redirect(redirectUrl);
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

    const merchantToken = req.session.accessTokens.find(
      (token) => token.merchantId === tokenData.merchantId,
    );

    if (merchantToken) {
      Object.assign(merchantToken, tokenData);
    } else {
      req.session.accessTokens.push(tokenData);
    }

    this.log('request', 'trace', { message: 'OAuth Completed and insert token to session', tokenData });

    return req.session.accessTokens;
  }
}

module.exports = DeveloperOAuth;

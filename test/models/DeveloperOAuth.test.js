const { DeveloperOAuth } = require('../../index');
const axios = require('axios');

describe('DeveloperOAuth', () => {
  const apiClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
  jest.spyOn(axios, 'create').mockImplementation(() => apiClient);

  const developerOAuth = new DeveloperOAuth({
    endpoint: 'endpoint',
    clientId: 'clientId',
    clientSecret: 'clientSecret',
    redirectUri: 'redirectUri',
    responseType: 'responseType',
    scope: 'scope',
  });

  test('#exchangeToken', async () => {
    const authorizationCode = 'authorizationCode';
    await developerOAuth.exchangeToken(authorizationCode);

    expect(apiClient.post).toBeCalledWith('oauth/token', {
      ...developerOAuth.config,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
  })

  test('#refreshToken', async () => {
    const token = 'token';
    await developerOAuth.refreshToken(token);

    expect(apiClient.post).toBeCalledWith('oauth/token', {
      ...developerOAuth.config,
      refresh_token: token,
      grant_type: 'refresh_token',
    });
  })

  test('#tokenInfo', async () => {
    const token = 'token';
    await developerOAuth.tokenInfo(token);

    expect(apiClient.get).toBeCalledWith('oauth/token/info', {
      ...developerOAuth.config,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  })
});

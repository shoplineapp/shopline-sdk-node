const express = require('express');

require('dotenv').config();

const { DeveloperOAuth, AppBridge } = require('../index');
const FileSystemTokenStore = require('./tokenStores/FileSystemTokenStore');

const app = express();
const port = 4000;

const developerOAuth = new DeveloperOAuth({
  endpoint: process.env.DEVELOPER_OAUTH_ENDPOINT,
  clientId: process.env.DEVELOPER_OAUTH_APP_CLIENT_ID,
  clientSecret: process.env.DEVELOPER_OAUTH_APP_CLIENT_SECRET,
  redirectUri: process.env.DEVELOPER_OAUTH_APP_REDIRECT_URI,
  scope: process.env.DEVELOPER_OAUTH_APP_SCOPE,
  logger: console.log,
});

app.use(express.json());

const appBridge = new AppBridge({
  developerOauth: developerOAuth,
  tokenStore: new FileSystemTokenStore({ path: './.tokens' }),
});

app.get('/auth', appBridge.startAuth());

app.get('/callback', appBridge.callback());

const apiRoutes = express.Router();

apiRoutes.use(appBridge.authenticate({ requireAccessToken: true }));

apiRoutes.get('/api/fetch-data', async (req, res) => {
  return res.json({
    currentMerchantId: res.locals.currentMerchantId,
    performerId: res.locals.performerId,
    accessToken: res.locals.currentToken,
  });
});

app.use(apiRoutes);

app.listen(port, () => {
  console.log(`Listening at localhost:${port}`);
});

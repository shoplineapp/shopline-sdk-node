const express = require('express');
const expressSession = require('express-session');

require('dotenv').config();

const { DeveloperOAuth, AppBridge } = require('../index');
const FileSystemTokenStore = require('./tokenStores/FileSystemTokenStore'); // DO NOT USE IN PRODUCTION

const app = express();
const port = 4000;

const developerOAuth = new DeveloperOAuth({
  endpoint: process.env.DEVELOPER_OAUTH_ENDPOINT,
  clientId: process.env.DEVELOPER_OAUTH_APP_CLIENT_ID,
  clientSecret: process.env.DEVELOPER_OAUTH_APP_CLIENT_SECRET,
  redirectUri: process.env.DEVELOPER_OAUTH_APP_REDIRECT_URI,
  scope: process.env.DEVELOPER_OAUTH_APP_SCOPE,
  logger: console.log,
  ensureLoginSession: false,
});

app.use(express.json());

app.use(expressSession({
  store: undefined, // by default, it uses MemoryStore. DO NOT USE IN PRODUCTION
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
}));

const appBridge = new AppBridge({
  developerOAuth: developerOAuth,
  tokenStore: new FileSystemTokenStore({ path: './.tokens' }),
});

app.get('/oauth', appBridge.startAuth());

app.get('/oauth/callback', appBridge.callback());

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

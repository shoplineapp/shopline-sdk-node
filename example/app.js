const express = require('express');
const session = require('express-session');
const Redis = require('ioredis');
const RedisStore = require('connect-redis')(session);

require('dotenv').config();

const { DeveloperOAuth, OpenApiClient } = require('..');

const app = express();
const port = 3000;
let redisStore;

if (process.env.SESSION_REDIS_ENABLED === 'true') {
  redisStore = new RedisStore(
    new Redis({
      host: process.env.SESSION_REDIS_HOST,
      port: process.env.SESSION_REDIS_PORT,
    }),
  );
}

const sessionStore = session({
  store: redisStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    domain: process.env.SESSION_DOMAIN,
    secure: String(process.env.SESSION_REDIS_SECURE_COOKIE) === 'true',
    maxAge: parseInt(process.env.SESSION_EXPIRY, 10),
  },
});

const developerOAuth = new DeveloperOAuth({
  endpoint: process.env.DEVELOPER_OAUTH_ENDPOINT,
  clientId: process.env.DEVELOPER_OAUTH_APP_CLIENT_ID,
  clientSecret: process.env.DEVELOPER_OAUTH_APP_CLIENT_SECRET,
  redirectUri: process.env.DEVELOPER_OAUTH_APP_REDIRECT_URI,
  scope: process.env.DEVELOPER_OAUTH_APP_SCOPE,
  logger: console.log,
});

app.use('/', sessionStore);
app.set('trust proxy', 1);

app.get('/oauth_callback', async (req, res, next) => developerOAuth.callback(req, res, next));

app.get(
  '/',
  async (req, res, next) => developerOAuth.authenticate(req, res, next),
  async (req, res, next) => {
    try {
      const client = new OpenApiClient({
        baseURL: process.env.OPEN_API_ENDPOINT,
        accessToken: res.locals.currentToken,
        logger: console.log,
      });

      const {
        current_merchant: currentMerchant,
        current_user: currentUser,
        current_staff: currentStaff,
      } = await client.request({
        url: 'auth/session',
      });

      // Requires products index grant from your application
      // Modify/delete this call if your app does not contain such grant
      const products = await client.request({
        url: 'products',
        params: { fields: ['items.title_translations'] },
      });

      // Requires orders index grant from your application
      // Modify/delete this call if your app does not contain such grant
      const orders = await client.request({
        url: 'orders',
        params: { fields: ['items.order_number'] },
      });

      res.send(
        `<h1>Hello ${currentMerchant.handle}</h1>` +
        `<p>Logged in as ${currentStaff.email}</p>` +
        `<p>This is app ${currentUser.token.application_id}` +
        '<h2>Products</h2>' +
        products.items.map( (item) => `<p>${item.title_translations.en}</p>` ).join('') +
        '<h2>Orders</h2>' +
        orders.items.map( (item) => `<p>${item.order_number}</p>` ).join('')
      );
    } catch (e) {
      next(e);
    }
  },
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(err.toString());
});

app.listen(port);

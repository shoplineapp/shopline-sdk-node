const express = require('express');
const session = require('express-session');
const Redis = require('ioredis');
const RedisStore = require('connect-redis')(session);
require('dotenv').config();

const { DeveloperOAuth } = require('../');

const app = express();
const port = 3000;

client = new Redis({
  host: process.env.SESSION_REDIS_HOST,
  port: process.env.SESSION_REDIS_PORT,
});

const sessionStore = session({
  store: new RedisStore({ client }),
  secret: process.env.SESSION_REDIS_SECRET,
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
  redirectUri: process.env.DEVELOPER_OAUTH_APP_REDIRECT_URI,
  scope: process.env.DEVELOPER_OAUTH_APP_SCOPE,
});

app.use('/', sessionStore);

app.get('/oauth_callback', async (req, res, next) => {
  return await developerOAuth.callback(req, res, next);
});

app.get(
  '/',
  async (req, res, next) => { return developerOAuth.authenticate(req, res, next) },
  async (req, res, next) => {
    return res.status(200).send('health')
  },
);

app.listen(port);

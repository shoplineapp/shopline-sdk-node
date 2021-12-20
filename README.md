# SHOPLINE SDK

## Installation

`yarn add https://github.com/shoplineapp/shopline-sdk-node.git`

## Feature

### Developer OAuth

#### Configuration

```js
const developerOAuth = new DeveloperOAuth({
  endpoint: process.env.DEVELOPER_OAUTH_ENDPOINT,
  clientId: process.env.DEVELOPER_OAUTH_APP_CLIENT_ID,
  clientSecret: process.env.DEVELOPER_OAUTH_APP_CLIENT_SECRET,
  redirectUri: process.env.DEVELOPER_OAUTH_APP_REDIRECT_URI,
  scope: process.env.DEVELOPER_OAUTH_APP_SCOPE,
  logger: log,
}),
```

#### API References

##### Authenticate Middleware

- authenticate
  - The following fields would be added into res.locals
    - res.locals.currentMerchantId
    - res.locals.currentToken
    - res.locals.performerId
    - res.locals.performerMerchantIds

```js
await developerOAuth.authenticate(req, res, next)
```

`developerOAuth.authenticate` will inject `currentMerchantId`, `currentToken`, `performerId` and `performerMerchantIds` into `req.locals`

##### Callback Middleware

- callback
  - Used as a callback handler under redirect_uri to inject access token to express session
  - Exchanged token would be added to req.session.accessTokens


```javascript
await developerOAuth.callback(req, res, next)
```

> :warning: **For development environment with multiple machines**: Session redis should be separated for multiple machines, as we will attempt to get latest token for redirect uri, and it may cause problem when redirecting.

`developerOAuth.callback` will handle OAuth callbacks and inject `accessTokens` into `req.session.accessTokens`

---

##### Ensure Login Session Configuration
DeveloperOAuth will ensure the access token login session with oauth service behind by default.
But this requires your app hosted in the same domain of the oauth service. i.e. *.shoplineapp.com.
If your app is hosted outside our domain, or you don't want the feature, you can disable it by setting `ensureLoginSession` to `false` when initialize.

```js
const developerOAuth = new DeveloperOAuth({
  endpoint: process.env.DEVELOPER_OAUTH_ENDPOINT,
  clientId: process.env.DEVELOPER_OAUTH_APP_CLIENT_ID,
  clientSecret: process.env.DEVELOPER_OAUTH_APP_CLIENT_SECRET,
  redirectUri: process.env.DEVELOPER_OAUTH_APP_REDIRECT_URI,
  scope: process.env.DEVELOPER_OAUTH_APP_SCOPE,
  ensureLoginSession: false,
  logger: log,
}),
```

### OpenAPI Client

##### Configuration

```js
const openApiClient = new OpenApiClient({
  baseURL: process.env.OPEN_API_ENDPOINT,
  accessToken: res.locals.currentToken,
  logger: log,
});
```

#### API References

- Get Merchant
  ```javascript
  await openApiClient.getMerchant(merchantId, fields)
  ```
- Get Staff
  ```javascript
  await openApiClient.getStaff(merchantId, fields, include_fields)
  ```
- Get Staff Permission
  ```javascript
  await openApiClient.getStaffPermission(merchantId, fields)
  ```
- request ([axios request config](https://github.com/axios/axios#request-config))
  ```javascript
  await openApiClient.request(options)
  ```

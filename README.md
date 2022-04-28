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

##### Trust Proxy
If your app is behind proxy, please set trust proxy in express.
Without doing so, it might affect the protocol, ip and host of the Request object passed in when express needs to read real values from `X-Forward-` headers

ref: https://expressjs.com/en/guide/behind-proxies.html

```js
app.set('trust proxy', 1)
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

---

### App Bridge

#### Configuration

```js
const appBridge = new AppBridge({
  developerOAuth: new DeveloperOauth({...}),
  tokenStore: new MyTokenStore()
})
```

#### TokenStore
Token store is responsible to saving and fetch token data from storage.
You need to implement the interface and pass to AppBridge when initializing it.

```typescript
interface TokenStoreInterface {
  async fetch(clientId: string, merchantId: string, staffId: string): Promise<any>
  async save(clientId: string, merchantId: string, staffId: string, tokenData: any): Promise<any>
}
```

#### API References

##### StartAuth Middleware

- startAuth
  - Used as starting point handler of OAuth flow triggered by app bridge frontend
    
```js
await appBridge.startAuth()
```

##### Callback Middleware

- callback
  - Used as a callback handler under redirect_uri to store access token through tokenStore provided

```javascript
await appBridge.callback()
```

##### Authenticate Middleware

- authenticate
  - Validating the session token passed along with request
  - Ensure access token exists in tokenStore if needed
  - The following fields would be added into res.locals
    - res.locals.currentMerchantId
    - res.locals.currentToken
    - res.locals.performerId

```js
await appBridge.authenticate( { requireAccessToken: <bool> } )
```


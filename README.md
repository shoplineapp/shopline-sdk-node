# SHOPLINE SDK

## Installation
`yarn add https://github.com/shoplineapp/shopline-sdk-node.git`

### Feature

##### Models - DeveloperOAuth Config

```javascript
const developerOAuth = new DeveloperOAuth({
  endpoint: process.env.DEVELOPER_OAUTH_ENDPOINT,
  clientId: process.env.DEVELOPER_OAUTH_APP_CLIENT_ID,
  clientSecret: process.env.DEVELOPER_OAUTH_APP_CLIENT_SECRET,
  redirectUri: process.env.DEVELOPER_OAUTH_APP_REDIRECT_URI,
  scope: process.env.DEVELOPER_OAUTH_APP_SCOPE,
  logger: log,
}),


```
- authenticate
  - The following fields would be added into res.locals
    - res.locals.currentMerchantId
    - res.locals.currentToken
    - res.locals.performerId
    - res.locals.performerMerchantIds

```javascript
await developerOAuth.authenticate(req, res, next)
```


- callback
  - Used as a callback handler under redirect_uri to inject access token to express session
  - Exchanged token would be added to req.session.accessTokens

```javascript
await developerOAuth.callback(req, res, next)
```

##### Models - OpenAPIClient

##### Config

```javascript
const openApiClient = new OpenApiClient({
  baseURL: process.env.OPEN_API_ENDPOINT,
  accessToken: res.locals.currentToken,
  logger: log,
});
```

- getMerchant
  ```javascript
  await openApiClient.getMerchant(merchantId, fields)
  ```
- getStaff (staffId, fields)
  ```javascript
  await openApiClient.getStaff(merchantId, fields, include_fields)
  ```
- getStaffPermission (staffId, fields)
  ```javascript
  await openApiClient.getStaffPermission(merchantId, fields)
  ```
- request ([axios request config](https://github.com/axios/axios#request-config))
  ```javascript
  await openApiClient.request(options)
  ```
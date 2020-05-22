# SHOPLINE SDK

### FEATURE


#### models

##### DeveloperOAuth Config

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
  - it will add this fields to res.locals
    - res.locals.currentMerchantId
    - res.locals.currentToken
    - res.locals.performerId
    - res.locals.performerMerchantIds

```javascript
await developerOAuth.authenticate(req, res, next)
```


- callback
  - use for redirect_uri inject access token to express session
  - add to req.session.accessTokens

```javascript
await developerOAuth.callback(req, res, next)
```

##### OpenAPIClient

##### Config

await openAPIClient.getMerchant(merchantId, fields)

```javascript
const openApiClient = new OpenApiClient({
  baseURL: process.env.OPEN_API_ENDPOINT,
  accessToken: res.locals.currentToken,
  logger: log,
});
```

- getMerchant
  ```javascript
  await openAPIClient.getMerchant(merchantId, fields)
  ```
- getStaff (staffId, fields)
  ```javascript
  await openAPIClient.getStaff(merchantId, fields)
  ```
- getStaffPermission (staffId, fields)
  ```javascript
  await openAPIClient.getStaffPermission(merchantId, fields)
  ```
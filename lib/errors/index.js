const BaseError = require('./BaseError');

class ConfigurationError extends BaseError {}
class SessionError extends BaseError {}
class RefreshTokenError extends BaseError {}
class DecodeTokenError extends BaseError {}

module.exports = {
  BaseError,
  ConfigurationError,
  SessionError,
  RefreshTokenError,
  DecodeTokenError,
};

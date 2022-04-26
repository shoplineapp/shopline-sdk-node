class BaseError extends Error {
  constructor(message, extras = {}) {
    super(message);
    this.name = this.constructor.name;
    this.extras = extras;

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}

module.exports = BaseError;

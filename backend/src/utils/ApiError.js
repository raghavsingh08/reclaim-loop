export class ApiError extends Error {
  constructor(statusCode, message, errors = [], code = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    if (code) this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

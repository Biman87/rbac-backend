// src/utils/AppError.js
// Operational error class that distinguishes known API errors
// from unexpected programming/system errors.

export class AppError extends Error {
  /**
   * @param {string} message   - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {any}   [errors]   - Optional structured error details (e.g. Zod issues)
   */
  constructor(message, statusCode, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 500 ? 'error' : 'fail';
    this.isOperational = true;
    this.errors = errors;

    // Preserve original stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

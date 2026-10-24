// src/utils/catchAsync.js
// Higher-order function that wraps async route handlers so you never
// need to write try/catch in controllers. Errors are forwarded to
// Express's next() and picked up by the global error handler.

/**
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<any>} fn
 * @returns {import('express').RequestHandler}
 */
export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

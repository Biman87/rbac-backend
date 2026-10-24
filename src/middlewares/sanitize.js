// src/middlewares/sanitize.js
// Sanitises request body, query, and params against XSS payloads.
//
// Uses the `xss` package to escape HTML entities in all string values,
// stopping injected <script> tags or event handlers from being stored
// in the database and later reflected back to clients.
//
// Note: Zod validation runs AFTER this middleware, so controllers always
// receive both sanitised AND schema-validated input.

import xss from 'xss';

/**
 * Recursively walks an object/array and applies xss() to every string value.
 * Non-string primitives and nulls are returned unchanged.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeValue(value) {
  if (typeof value === 'string') return xss(value);
  if (Array.isArray(value))      return value.map(sanitizeValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
}

/**
 * Express middleware that sanitises req.body, req.query, and req.params.
 * @type {import('express').RequestHandler}
 */
export const xssSanitize = (req, res, next) => {
  if (req.body)   req.body   = sanitizeValue(req.body);
  if (req.query)  req.query  = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

// src/middlewares/validate.js
// Reusable Zod validation middleware factory.
// Validates req.body, req.query, and req.params against the provided schema.
// On failure it formats Zod issues into a clean structure and passes them
// to the global error handler via next().

import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * Formats a ZodError into a flat array of { field, message } objects.
 * @param {ZodError} err
 * @returns {{ field: string, message: string }[]}
 */
function formatZodErrors(err) {
  return err.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Middleware factory — validates the request against a Zod schema.
 *
 * The schema should be a z.object() whose keys are 'body', 'query', and/or
 * 'params'. Only the keys present in the schema are validated.
 *
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/register', validate(registerSchema), authController.register);
 */
export const validate = (schema) => (req, res, next) => {
  try {
    // Parse returns the coerced/transformed value (e.g. trimmed, lowercased)
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Overwrite with transformed values so controllers always get clean data
    if (parsed.body)   req.body   = parsed.body;
    if (parsed.query)  req.query  = parsed.query;
    if (parsed.params) req.params = parsed.params;

    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(
        new AppError('Validation failed', 422, formatZodErrors(err))
      );
    }
    next(err);
  }
};

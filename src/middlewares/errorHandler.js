// src/middlewares/errorHandler.js
// Global Express error-handling middleware.
// Must be registered LAST in the middleware chain (after all routes).

import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

// ─── Helpers for specific Prisma / JWT errors ─────────────────────────────────

/**
 * Converts a Prisma "unique constraint" violation into an AppError.
 * Prisma error code P2002 = unique constraint failed.
 */
function handlePrismaUniqueConstraint(err) {
  const field = err.meta?.target?.[0] ?? 'field';
  return new AppError(`A record with that ${field} already exists.`, 409);
}

/**
 * Converts a Prisma "record not found" error.
 * Prisma error code P2025 = record required for query not found.
 */
function handlePrismaNotFound() {
  return new AppError('The requested record was not found.', 404);
}

/**
 * Formats the error response body.
 * In production we hide internal details; in development we expose the stack.
 */
function sendError(err, req, res) {
  const isDev = !env.isProduction;

  // Operational / known errors — safe to expose to client
  if (err.isOperational) {
    const body = {
      status: err.status,
      message: err.message,
    };

    if (err.errors) body.errors = err.errors;
    if (isDev) body.stack = err.stack;

    return res.status(err.statusCode).json(body);
  }

  // Programming / unknown errors — don't leak details in production
  if (isDev) {
    // Full details in dev
    return res.status(500).json({
      status: 'error',
      message: err.message,
      stack: err.stack,
      err,
    });
  }

  // Generic response in production
  console.error('UNHANDLED ERROR 💥:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong. Please try again later.',
  });
}

// ─── Global Error Handler ─────────────────────────────────────────────────────

/**
 * Express 4-argument error handler.
 * @type {import('express').ErrorRequestHandler}
 */
export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  // ── Translate known error types into operational AppErrors ──────────────────
  if (error.code === 'P2002') error = handlePrismaUniqueConstraint(error);
  if (error.code === 'P2025') error = handlePrismaNotFound();

  sendError(error, req, res);
};

// ─── 404 Handler ─────────────────────────────────────────────────────────────

/**
 * Catch-all for undefined routes.
 * Register this BEFORE the globalErrorHandler.
 * @type {import('express').RequestHandler}
 */
export const notFound = (req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404));
};

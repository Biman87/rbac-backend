// src/app.js
// Express application factory — separates app configuration from server
// startup so the app can be tested without binding to a port.

import express from 'express';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import v1Router from './routes/index.js';

// ── Middleware imports ────────────────────────────────────────────────────────
import { requestLogger } from './middlewares/logger.js';
import {
  helmetMiddleware,
  corsMiddleware,
  apiRateLimiter,
  hppMiddleware,
} from './middlewares/security.js';
import { xssSanitize } from './middlewares/sanitize.js';
import { globalErrorHandler, notFound } from './middlewares/errorHandler.js';

const app = express();

// ─── 1. Security headers (Helmet) ─────────────────────────────────────────────
// Must be first — sets HTTP headers before any response is sent.
app.use(helmetMiddleware);

// ─── 2. CORS ──────────────────────────────────────────────────────────────────
// Must come before route handlers so preflight OPTIONS requests are answered.
app.use(corsMiddleware);

// ─── 3. Request logger ────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── 4. Body / Cookie parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── 5. HTTP Parameter Pollution protection ───────────────────────────────────
app.use(hppMiddleware);

// ─── 6. XSS sanitisation ──────────────────────────────────────────────────────
// Runs before Zod validation so controllers always get clean, safe input.
app.use(xssSanitize);

// ─── 7. General API rate limiter ──────────────────────────────────────────────
// Applied to all /api/* routes. Auth endpoints get their own tighter limiter
// mounted directly on the auth router (see auth.routes.js).
app.use('/api', apiRateLimiter);

// ─── 8. API Routes ────────────────────────────────────────────────────────────
app.use('/api/v1', v1Router);

// ─── 9. 404 handler ───────────────────────────────────────────────────────────
// Must come after all valid routes.
app.use(notFound);

// ─── 10. Global error handler ─────────────────────────────────────────────────
// Must be last and have exactly 4 arguments.
app.use(globalErrorHandler);

export default app;

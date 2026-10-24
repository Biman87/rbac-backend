// src/middlewares/security.js
// Centralised security middleware stack.
// Each export is a ready-to-use middleware (or array of middlewares)
// that app.js mounts before the route layer.

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { env } from '../config/env.js';

// ─── Helmet ───────────────────────────────────────────────────────────────────
// Sets ~15 security-related HTTP response headers in one call.
// Notable ones: X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security,
// Content-Security-Policy, Referrer-Policy, etc.

export const helmetMiddleware = helmet({
  // Allow same-origin framing in dev; lock it down in prod
  frameguard: { action: env.isProduction ? 'deny' : 'sameorigin' },
  // CSP: restrictive baseline — override per-project if you serve HTML
  contentSecurityPolicy: env.isProduction
    ? undefined      // use helmet's default strict CSP in production
    : false,         // disable CSP in dev so browser tools work freely
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Parses the CORS_ORIGINS env var (comma-separated list) into an array.
// credentials: true is required for cross-origin cookie-based auth.

const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin "${origin}" is not allowed`));
    }
  },
  credentials: true,           // required for Set-Cookie to work cross-origin
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

/**
 * Strict limiter for auth endpoints (register, login).
 * Default: 20 requests per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,   // Return rate limit info in RateLimit-* headers (RFC 6585)
  legacyHeaders: false,    // Disable the deprecated X-RateLimit-* headers
  message: {
    status: 'fail',
    message: `Too many requests from this IP. Please try again after ${env.RATE_LIMIT_WINDOW_MINUTES} minutes.`,
  },
  skipSuccessfulRequests: false,
});

/**
 * General limiter applied to all API routes.
 * Default: 200 requests per 15 minutes per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: `Too many requests from this IP. Please try again after ${env.RATE_LIMIT_WINDOW_MINUTES} minutes.`,
  },
  skipSuccessfulRequests: true,  // Don't count successful responses against the limit
});

// ─── HTTP Parameter Pollution ─────────────────────────────────────────────────
// Prevents attackers from sending duplicate query/body parameters that could
// confuse middleware or cause unexpected behaviour (e.g. ?role=ADMIN&role=CUSTOMER).
// Whitelist any params that legitimately accept multiple values.

export const hppMiddleware = hpp({
  whitelist: [], // e.g. ['filter', 'sort'] if you ever add those query features
});

// src/middlewares/logger.js
// HTTP request logger using morgan.
//
// Development: colourised, human-readable "dev" format.
// Production:  structured JSON log lines written to stdout so they can be
//              ingested by any log aggregator (Datadog, CloudWatch, Loki, etc.)

import morgan from 'morgan';
import { env } from '../config/env.js';

// ─── Production: structured JSON ─────────────────────────────────────────────

// Define a custom JSON token stream so every request produces a single-line
// JSON object — easy to parse and index downstream.
morgan.token('body-size', (req) => {
  const len = req.headers['content-length'];
  return len ? `${len}b` : '-';
});

const jsonFormat = (tokens, req, res) =>
  JSON.stringify({
    ts: new Date().toISOString(),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res)),
    responseTime: `${tokens['response-time'](req, res)}ms`,
    bodySize: tokens['body-size'](req, res),
    userAgent: req.headers['user-agent'] ?? '-',
    ip: req.ip,
  });

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Returns the appropriate morgan middleware based on the environment.
 * Use as: app.use(requestLogger)
 */
export const requestLogger = env.isProduction
  ? morgan(jsonFormat)        // structured JSON in production
  : morgan('dev');            // colourised shorthand in development

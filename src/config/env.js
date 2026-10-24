// src/config/env.js
// Centralised environment variable access with fail-fast validation.
// Import this module early (in server.js) so missing vars are caught at startup.

import 'dotenv/config';

/**
 * Reads an env variable and throws if it is missing/empty.
 * @param {string} key
 * @returns {string}
 */
function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  DATABASE_URL: required('DATABASE_URL'),

  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  COOKIE_EXPIRES_IN_DAYS: parseInt(process.env.COOKIE_EXPIRES_IN_DAYS || '7', 10),

  // Comma-separated list of allowed CORS origins, e.g. "http://localhost:5173,https://myapp.com"
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5173',

  // Rate limiting — auth endpoints (requests per window per IP)
  RATE_LIMIT_AUTH_MAX: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20', 10),
  // Rate limiting — general API endpoints
  RATE_LIMIT_API_MAX: parseInt(process.env.RATE_LIMIT_API_MAX || '200', 10),
  // Window duration in minutes (shared by all limiters)
  RATE_LIMIT_WINDOW_MINUTES: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10),

  get isProduction() {
    return this.NODE_ENV === 'production';
  },
};

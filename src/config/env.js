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

  // Access token — short-lived (default 15 minutes)
  JWT_SECRET:      required('JWT_SECRET'),
  JWT_EXPIRES_IN:  process.env.JWT_EXPIRES_IN || '15m',

  // Refresh token — long-lived (default 7 days)
  REFRESH_TOKEN_SECRET:      required('REFRESH_TOKEN_SECRET'),
  REFRESH_TOKEN_EXPIRES_IN:  process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  COOKIE_EXPIRES_IN_DAYS: parseInt(process.env.COOKIE_EXPIRES_IN_DAYS || '7', 10),

  // Frontend URL — used to build password-reset and email-verify links
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  // SMTP — required only in production; dev uses Ethereal auto-account
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'RBAC App <noreply@rbac.dev>',

  // Comma-separated list of allowed CORS origins
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5173',

  RATE_LIMIT_AUTH_MAX:        parseInt(process.env.RATE_LIMIT_AUTH_MAX        || '20',  10),
  RATE_LIMIT_API_MAX:         parseInt(process.env.RATE_LIMIT_API_MAX         || '200', 10),
  RATE_LIMIT_WINDOW_MINUTES:  parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES  || '15',  10),

  get isProduction() {
    return this.NODE_ENV === 'production';
  },
};

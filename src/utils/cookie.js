// src/utils/cookie.js
// Centralised cookie options so they stay consistent across
// login and logout handlers.

import { env } from '../config/env.js';

/**
 * Returns the options object for the auth cookie.
 * @returns {import('express').CookieOptions}
 */
export function cookieOptions() {
  return {
    httpOnly: true,                        // not accessible via document.cookie
    secure: env.isProduction,              // HTTPS-only in production
    sameSite: env.isProduction ? 'strict' : 'lax', // CSRF protection
    maxAge: env.COOKIE_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000, // ms
  };
}

/**
 * Signs the token and attaches it as an HTTP-only cookie on the response.
 * Also returns the token so tests / other callers can inspect it.
 * @param {import('express').Response} res
 * @param {string} token
 */
export function attachAuthCookie(res, token) {
  res.cookie('token', token, cookieOptions());
}

/**
 * Clears the auth cookie.
 * @param {import('express').Response} res
 */
export function clearAuthCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'strict' : 'lax',
  });
}

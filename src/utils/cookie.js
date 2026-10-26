// src/utils/cookie.js
// Centralised cookie helpers for access token and refresh token cookies.

import { env } from '../config/env.js';

// ─── Shared options factory ───────────────────────────────────────────────────

function baseCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure:   env.isProduction,
    sameSite: env.isProduction ? 'strict' : 'lax',
    maxAge:   maxAgeMs,
  };
}

// ─── Access token cookie ──────────────────────────────────────────────────────

export function attachAuthCookie(res, token) {
  res.cookie('token', token, baseCookieOptions(
    env.COOKIE_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
  ));
}

export function clearAuthCookie(res) {
  res.clearCookie('token', baseCookieOptions(0));
}

// ─── Refresh token cookie ─────────────────────────────────────────────────────

/** Refresh token lives in its own HTTP-only cookie, separate from the access token. */
export function attachRefreshCookie(res, rawToken, expiresAt) {
  const maxAge = expiresAt.getTime() - Date.now();
  res.cookie('refreshToken', rawToken, {
    ...baseCookieOptions(maxAge),
    path: '/api/v1/auth/refresh',   // restrict to refresh endpoint only
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', {
    ...baseCookieOptions(0),
    path: '/api/v1/auth/refresh',
  });
}

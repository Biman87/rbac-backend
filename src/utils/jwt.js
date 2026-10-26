// src/utils/jwt.js
// JWT sign / verify helpers for access tokens and refresh tokens.
// Access tokens are short-lived (15m default) and carried in an HTTP-only cookie.
// Refresh tokens are long-lived (7d default), stored hashed in the DB,
// and also carried in a separate HTTP-only cookie.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

// ─── Access token ─────────────────────────────────────────────────────────────

/**
 * Signs a short-lived access token.
 * @param {{ id: string, role: string }} payload
 * @returns {string}
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/**
 * Verifies an access token.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 * @param {string} token
 * @returns {{ id: string, role: string, iat: number, exp: number }}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

// ─── Refresh token ────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random opaque refresh token string.
 * We store the SHA-256 hash of this in the DB — the raw value goes to the client.
 * @returns {{ raw: string, hashed: string, expiresAt: Date }}
 */
export function generateRefreshToken() {
  const raw      = crypto.randomBytes(64).toString('hex');       // 128-char hex
  const hashed   = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(
    Date.now() + parseDurationMs(env.REFRESH_TOKEN_EXPIRES_IN)
  );
  return { raw, hashed, expiresAt };
}

/**
 * Hashes a raw refresh token for DB comparison.
 * @param {string} raw
 * @returns {string}
 */
export function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ─── Legacy alias (keeps protect middleware working unchanged) ─────────────────
export const signToken  = signAccessToken;
export const verifyToken = verifyAccessToken;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parses a duration string like "7d", "15m", "1h" into milliseconds.
 * @param {string} duration
 * @returns {number} milliseconds
 */
function parseDurationMs(duration) {
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const match  = String(duration).match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: "${duration}"`);
  return parseInt(match[1], 10) * units[match[2]];
}

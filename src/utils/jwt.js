// src/utils/jwt.js
// JWT sign / verify helpers.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs a JWT containing the user's id and role.
 * @param {{ id: string, role: string }} payload
 * @returns {string}
 */
export function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws a JsonWebTokenError / TokenExpiredError on failure.
 * @param {string} token
 * @returns {{ id: string, role: string, iat: number, exp: number }}
 */
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

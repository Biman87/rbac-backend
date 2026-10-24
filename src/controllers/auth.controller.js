// src/controllers/auth.controller.js
// Handles all authentication logic: register, login, logout, me.

import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { signToken } from '../utils/jwt.js';
import { attachAuthCookie, clearAuthCookie } from '../utils/cookie.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Signs a token, sets the cookie, and sends the user payload.
 * Extracted to avoid duplication between register and login.
 *
 * The JWT payload embeds the role *name* string (e.g. "ADMIN") so that
 * restrictTo() can compare it without an extra DB round-trip.
 */
function sendAuthResponse(user, statusCode, res) {
  const token = signToken({ id: user.id, role: user.role.name });
  attachAuthCookie(res, token);

  // Strip the password before sending — it should never leave the server
  const { password: _pw, ...safeUser } = user;

  res.status(statusCode).json({
    status: 'success',
    data: { user: safeUser },
  });
}

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new user account. Passwords are hashed with bcrypt (cost = 12).
 * Accepts an optional `roleName` in the body (defaults to "CUSTOMER").
 * Throws 400 if the requested role name does not exist in the roles table.
 * The Prisma unique-constraint error (P2002) is handled by the global error
 * handler and surfaces as a 409 Conflict.
 */
export const register = catchAsync(async (req, res, next) => {
  const { email, password, roleName } = req.body;

  // Resolve the role by name — default to CUSTOMER if not specified
  const roleLookup = roleName ?? 'CUSTOMER';
  const role = await prisma.role.findUnique({ where: { name: roleLookup } });
  if (!role) {
    return next(new AppError(`Role "${roleLookup}" does not exist.`, 400));
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      roleId: role.id,
    },
    include: { role: true },
  });

  sendAuthResponse(user, 201, res);
});

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 * Validates credentials and issues a JWT via cookie.
 * Intentionally uses the same generic error message for invalid email AND
 * wrong password to prevent user enumeration attacks.
 */
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Fetch user including role relation — password needed for comparison
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  // Constant-time comparison prevents timing attacks
  const passwordMatch = user
    ? await bcrypt.compare(password, user.password)
    : false;

  if (!user || !passwordMatch) {
    return next(new AppError('Invalid email or password.', 401));
  }

  sendAuthResponse(user, 200, res);
});

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/logout
 * Clears the auth cookie. No authentication required — clearing
 * a missing cookie is a no-op and always succeeds.
 */
export const logout = (req, res) => {
  clearAuthCookie(res);

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.',
  });
};

// ─── Me ───────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile.
 * req.user is populated by the protect middleware (password already excluded).
 */
export const getMe = catchAsync(async (req, res, next) => {
  // Re-fetch from DB to guarantee freshness (protect already confirmed existence)
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      roleId: true,
      role: {
        select: { id: true, name: true, description: true },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

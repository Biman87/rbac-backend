// src/middlewares/auth.middleware.js
// protect        — verifies the JWT from the HTTP-only cookie and attaches the
//                  full user record to req.user.
// restrictTo     — factory that returns a middleware guarding routes by role name.
// hasPermission  — factory that guards routes by a specific action+resource pair.

import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';
import { catchAsync } from '../utils/catchAsync.js';
import prisma from '../config/prisma.js';

// ─── protect ──────────────────────────────────────────────────────────────────

/**
 * Ensures the request carries a valid JWT in the 'token' cookie.
 * On success, populates req.user with the database user record (sans password).
 * Also rejects deactivated accounts (isActive = false).
 */
export const protect = catchAsync(async (req, res, next) => {
  // 1. Extract token from cookie
  const token = req.cookies?.token;

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access.', 401));
  }

  // 2. Verify token (throws JsonWebTokenError / TokenExpiredError on failure)
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token. Please log in again.', 401));
  }

  // 3. Confirm the user still exists and is active
  const currentUser = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      isActive: true,
      roleId: true,
      role: {
        select: { id: true, name: true },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }

  // 4. Attach user to request — available to all subsequent handlers.
  //    Flatten role.name onto req.user.role so restrictTo() keeps working.
  req.user = { ...currentUser, role: currentUser.role.name };
  next();
});

// ─── restrictTo ───────────────────────────────────────────────────────────────

/**
 * Authorization middleware factory.
 * Restricts access to users whose role is in the provided list.
 *
 * Must be used AFTER protect (relies on req.user being set).
 *
 * @param {...string} roles - Allowed roles, e.g. 'ADMIN', 'MANAGER'
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.get('/admin-only', protect, restrictTo('ADMIN'), handler);
 */
export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }
    next();
  };

// ─── hasPermission ────────────────────────────────────────────────────────────

/**
 * Fine-grained permission check middleware factory.
 * Verifies the current user's role has a specific action+resource permission.
 *
 * Must be used AFTER protect (relies on req.user.roleId being set).
 * ADMINs bypass the check — they implicitly have all permissions.
 *
 * @param {string} action   - e.g. 'read', 'create', 'update', 'delete', 'manage'
 * @param {string} resource - e.g. 'users', 'roles', 'reports'
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.get('/reports', protect, hasPermission('read', 'reports'), handler);
 */
export const hasPermission = (action, resource) =>
  catchAsync(async (req, res, next) => {
    // ADMINs have implicit full access — skip the DB lookup
    if (req.user?.role === 'ADMIN') return next();

    const assignment = await prisma.rolePermission.findFirst({
      where: {
        roleId: req.user.roleId,
        permission: { action, resource },
      },
    });

    if (!assignment) {
      return next(
        new AppError(
          `You do not have the "${action}:${resource}" permission required for this action.`,
          403
        )
      );
    }

    next();
  });

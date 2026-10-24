// src/controllers/user.controller.js
// User Management handlers — admin CRUD + own-profile operations.

import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

// ─── Shared select shape ──────────────────────────────────────────────────────
const USER_SELECT = {
  id: true,
  email: true,
  isActive: true,
  roleId: true,
  role: { select: { id: true, name: true, description: true } },
  createdAt: true,
  updatedAt: true,
};

// ─── Shared helper ────────────────────────────────────────────────────────────

/**
 * Fetches a user by ID (sans password) and throws 404 if not found.
 * @param {string} id
 */
async function findUserOrFail(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });
  if (!user) {
    throw new AppError(`No user found with ID: ${id}`, 404);
  }
  return user;
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /api/v1/users ────────────────────────────────────────────────────────

/**
 * Lists all users with cursor-free offset pagination and optional role filter.
 *
 * Query params (all optional, validated by Zod):
 *   page  {number} – 1-indexed page number (default 1)
 *   limit {number} – items per page, max 100 (default 20)
 *   role  {string} – filter by role name, e.g. ?role=ADMIN
 */
export const getAllUsers = catchAsync(async (req, res, next) => {
  const { page, limit, role } = req.query;

  const skip = (page - 1) * limit;

  // Build an optional where clause for role filtering
  const where = role ? { role: { name: role } } : {};

  // Run count + paginated fetch in parallel for efficiency
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    status: 'success',
    results: users.length,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { users },
  });
});

// ─── GET /api/v1/users/:id ────────────────────────────────────────────────────

/**
 * Returns a single user by ID.
 * Throws 404 if the user does not exist.
 */
export const getUserById = catchAsync(async (req, res, next) => {
  const user = await findUserOrFail(req.params.id);

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

// ─── PATCH /api/v1/users/:id/role ─────────────────────────────────────────────

/**
 * Assigns a new role to a user.
 * - Throws 404 if the user or role does not exist.
 * - Throws 400 if you attempt to demote the last ADMIN — this keeps the
 *   system from being locked out.
 */
export const assignRole = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { roleId } = req.body;

  // 1. Confirm target user exists
  const targetUser = await findUserOrFail(id);

  // 2. Confirm new role exists
  const newRole = await prisma.role.findUnique({ where: { id: roleId } });
  if (!newRole) {
    return next(new AppError(`No role found with ID: ${roleId}`, 404));
  }

  // 3. Guard: don't allow demoting the last ADMIN
  if (targetUser.role.name === 'ADMIN' && newRole.name !== 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { role: { name: 'ADMIN' } },
    });
    if (adminCount <= 1) {
      return next(
        new AppError(
          'Cannot change role: this is the last ADMIN account. Assign another ADMIN first.',
          400
        )
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { roleId },
    select: USER_SELECT,
  });

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

// ─── DELETE /api/v1/users/:id ─────────────────────────────────────────────────

/**
 * Deletes a user by ID.
 * - Throws 404 if the user does not exist.
 * - Throws 400 if the caller attempts to delete their own account via this
 *   endpoint (use DELETE /users/me for self-deletion if you add that later).
 * - Throws 400 if it would delete the last ADMIN.
 */
export const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Prevent self-deletion via the admin route
  if (id === req.user.id) {
    return next(
      new AppError(
        'You cannot delete your own account via this endpoint.',
        400
      )
    );
  }

  const targetUser = await findUserOrFail(id);

  // Guard: last ADMIN protection
  if (targetUser.role.name === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { role: { name: 'ADMIN' } },
    });
    if (adminCount <= 1) {
      return next(
        new AppError(
          'Cannot delete the last ADMIN account. Assign another ADMIN first.',
          400
        )
      );
    }
  }

  await prisma.user.delete({ where: { id } });

  res.status(204).send();
});

// ════════════════════════════════════════════════════════════════════════════
//  OWN-PROFILE ROUTES  (authenticated user only)
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /api/v1/users/me ─────────────────────────────────────────────────────

/**
 * Returns the authenticated user's own profile.
 * Re-fetches from DB to guarantee freshness.
 */
export const getMe = catchAsync(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: USER_SELECT,
  });

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

// ─── PATCH /api/v1/users/me ───────────────────────────────────────────────────

/**
 * Updates the authenticated user's own email.
 * - Prisma P2002 (duplicate email) is caught by the global error handler → 409.
 */
export const updateMe = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { email },
    select: USER_SELECT,
  });

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

// ─── PATCH /api/v1/users/me/password ─────────────────────────────────────────

/**
 * Changes the authenticated user's password.
 * - Requires the current password for verification.
 * - Hashes the new password before storing.
 * - newPassword !== confirmPassword is caught by Zod schema.
 * - newPassword === currentPassword is caught by Zod schema.
 */
export const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // Fetch the full user record — we need the stored hash
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashedPassword },
  });

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully.',
  });
});

// ─── PATCH /api/v1/users/:id/status  (#21) ───────────────────────────────────

/**
 * Activates or deactivates a user account.
 * - Throws 404 if the user does not exist.
 * - Throws 400 if an admin tries to deactivate their own account.
 * - Throws 400 if trying to deactivate the last active ADMIN.
 */
export const updateStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isActive } = req.body;

  // Prevent self-deactivation
  if (id === req.user.id && isActive === false) {
    return next(new AppError('You cannot deactivate your own account.', 400));
  }

  const targetUser = await findUserOrFail(id);

  // Guard: don't allow deactivating the last active ADMIN
  if (targetUser.role.name === 'ADMIN' && isActive === false) {
    const activeAdminCount = await prisma.user.count({
      where: { role: { name: 'ADMIN' }, isActive: true },
    });
    if (activeAdminCount <= 1) {
      return next(
        new AppError('Cannot deactivate the last active ADMIN account.', 400)
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: USER_SELECT,
  });

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

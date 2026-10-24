// src/routes/admin.routes.js
// RBAC test / admin-only endpoints.

import { Router } from 'express';
import { protect, restrictTo, hasPermission } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();

// ─── GET /api/v1/admin/dashboard  (#23) ──────────────────────────────────────

/**
 * RBAC authorization test endpoint.
 * Requires: authenticated + ADMIN role.
 * Returns a summary dashboard — proves that only ADMINs can reach this.
 */
router.get(
  '/dashboard',
  protect,
  restrictTo('ADMIN'),
  catchAsync(async (req, res) => {
    // Gather summary stats in parallel
    const [userCount, roleCount, permissionCount, activeUserCount] = await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.user.count({ where: { isActive: true } }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        message: `Welcome to the admin dashboard, ${req.user.email}`,
        stats: {
          totalUsers: userCount,
          activeUsers: activeUserCount,
          inactiveUsers: userCount - activeUserCount,
          totalRoles: roleCount,
          totalPermissions: permissionCount,
        },
      },
    });
  })
);

// ─── GET /api/v1/admin/permission-test  (bonus demo endpoint) ─────────────────

/**
 * Demonstrates the hasPermission middleware.
 * Requires the caller's role to have the "manage:users" permission
 * (or be ADMIN, which bypasses the check automatically).
 */
router.get(
  '/permission-test',
  protect,
  hasPermission('manage', 'users'),
  (req, res) => {
    res.status(200).json({
      status: 'success',
      data: {
        message: `You have the "manage:users" permission.`,
        user: { id: req.user.id, email: req.user.email, role: req.user.role },
      },
    });
  }
);

export default router;

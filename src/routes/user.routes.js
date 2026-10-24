// src/routes/user.routes.js
// User Management routes:
//   /me/*        — authenticated user's own profile (any role)
//   /:id         — admin operations on any user

import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import {
  listUsersSchema,
  userIdSchema,
  assignRoleSchema,
  updateMeSchema,
  changePasswordSchema,
  updateStatusSchema,
} from '../validations/user.validation.js';
import {
  getAllUsers,
  getUserById,
  assignRole,
  deleteUser,
  getMe,
  updateMe,
  changePassword,
  updateStatus,
} from '../controllers/user.controller.js';

const router = Router();

// All user routes require authentication
router.use(protect);

// ── Own-profile routes (any authenticated user) ───────────────────────────────
// IMPORTANT: /me routes must be defined BEFORE /:id so Express doesn't
// treat the literal string "me" as a dynamic :id parameter.

router.get('/me', getMe);
router.patch('/me', validate(updateMeSchema), updateMe);
router.patch('/me/password', validate(changePasswordSchema), changePassword);

// ── Admin-only routes ─────────────────────────────────────────────────────────

router.get('/', restrictTo('ADMIN'), validate(listUsersSchema), getAllUsers);
router.get('/:id', restrictTo('ADMIN'), validate(userIdSchema), getUserById);
router.patch('/:id/role', restrictTo('ADMIN'), validate(assignRoleSchema), assignRole);
router.patch('/:id/status', restrictTo('ADMIN'), validate(updateStatusSchema), updateStatus);
router.delete('/:id', restrictTo('ADMIN'), validate(userIdSchema), deleteUser);

export default router;

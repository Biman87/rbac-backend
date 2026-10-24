// src/routes/role.routes.js
// All role management endpoints are restricted to ADMIN users.

import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import {
  createRoleSchema,
  updateRoleSchema,
  roleIdSchema,
} from '../validations/role.validation.js';
import {
  assignPermissionsSchema,
  rolePermissionIdSchema,
  roleIdSchema as roleIdForPermSchema,
} from '../validations/permission.validation.js';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from '../controllers/role.controller.js';
import {
  getRolePermissions,
  assignPermissionsToRole,
  removePermissionFromRole,
} from '../controllers/permission.controller.js';

const router = Router();

// Apply protect + restrictTo globally to every route in this file.
router.use(protect, restrictTo('ADMIN'));

// ── Collection routes ─────────────────────────────────────────────────────────

router
  .route('/')
  .get(getAllRoles)
  .post(validate(createRoleSchema), createRole);

// ── Role ↔ Permission assignment routes ──────────────────────────────────────
// IMPORTANT: defined before /:id so Express doesn't swallow /:id/permissions

router
  .route('/:id/permissions')
  .get(validate(roleIdForPermSchema), getRolePermissions)           // #15
  .post(validate(assignPermissionsSchema), assignPermissionsToRole); // #16

router.delete(
  '/:id/permissions/:permissionId',
  validate(rolePermissionIdSchema),
  removePermissionFromRole                                          // #17
);

// ── Member routes ─────────────────────────────────────────────────────────────

router
  .route('/:id')
  .get(validate(roleIdSchema), getRoleById)
  .patch(validate(updateRoleSchema), updateRole)
  .delete(validate(roleIdSchema), deleteRole);

export default router;

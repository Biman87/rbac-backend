// src/routes/permission.routes.js
// Permission CRUD + Role ↔ Permission assignment.
// All routes are ADMIN-only.

import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import {
  createPermissionSchema,
  updatePermissionSchema,
  permissionIdSchema,
} from '../validations/permission.validation.js';
import {
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
} from '../controllers/permission.controller.js';

const router = Router();

router.use(protect, restrictTo('ADMIN'));

// ── Permission CRUD ───────────────────────────────────────────────────────────

router
  .route('/')
  .get(getAllPermissions)                                  // #10
  .post(validate(createPermissionSchema), createPermission); // #12

router
  .route('/:id')
  .get(validate(permissionIdSchema), getPermissionById)   // #11
  .patch(validate(updatePermissionSchema), updatePermission) // #13
  .delete(validate(permissionIdSchema), deletePermission); // #14

export default router;

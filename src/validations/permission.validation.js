// src/validations/permission.validation.js
// Zod schemas for Permission CRUD and Role-Permission assignment.

import { z } from 'zod';

// ─── Shared field definitions ─────────────────────────────────────────────────

// Allowed action verbs — extend this list as your domain grows
const ACTION_VALUES = ['create', 'read', 'update', 'delete', 'manage'];

const actionField = z.enum(ACTION_VALUES, {
  errorMap: () => ({
    message: `action must be one of: ${ACTION_VALUES.join(', ')}`,
  }),
});

const resourceField = z
  .string({ required_error: 'resource is required' })
  .trim()
  .toLowerCase()
  .min(2, 'resource must be at least 2 characters')
  .max(50, 'resource must not exceed 50 characters')
  .regex(/^[a-z][a-z0-9_]*$/, 'resource must be lowercase letters, digits, or underscores');

const nameField = z
  .string({ required_error: 'name is required' })
  .trim()
  .min(2, 'name must be at least 2 characters')
  .max(100, 'name must not exceed 100 characters');

const descriptionField = z
  .string()
  .trim()
  .max(255, 'description must not exceed 255 characters')
  .optional();

// ─── ID params ────────────────────────────────────────────────────────────────

const permissionIdParam = z.object({
  params: z.object({
    id: z.string({ required_error: 'Permission ID is required' }).min(1),
  }),
});

const roleAndPermissionIdParams = z.object({
  params: z.object({
    id: z.string({ required_error: 'Role ID is required' }).min(1),
    permissionId: z.string({ required_error: 'Permission ID is required' }).min(1),
  }),
});

const roleIdParam = z.object({
  params: z.object({
    id: z.string({ required_error: 'Role ID is required' }).min(1),
  }),
});

// ─── Create Permission ────────────────────────────────────────────────────────

export const createPermissionSchema = z.object({
  body: z.object({
    name: nameField,
    action: actionField,
    resource: resourceField,
    description: descriptionField,
  }),
});

// ─── Update Permission ────────────────────────────────────────────────────────

export const updatePermissionSchema = permissionIdParam.merge(
  z.object({
    body: z
      .object({
        name: nameField.optional(),
        action: actionField.optional(),
        resource: resourceField.optional(),
        description: descriptionField,
      })
      .refine(
        (data) => Object.values(data).some((v) => v !== undefined),
        { message: 'At least one field must be provided for update' }
      ),
  })
);

// ─── Single permission by ID ──────────────────────────────────────────────────

export const permissionIdSchema = permissionIdParam;

// ─── Assign permissions to a role ─────────────────────────────────────────────
// Accepts an array of permission IDs so multiple can be assigned in one call.

export const assignPermissionsSchema = roleIdParam.merge(
  z.object({
    body: z.object({
      permissionIds: z
        .array(z.string().min(1, 'Each permission ID must be a non-empty string'), {
          required_error: 'permissionIds is required',
          invalid_type_error: 'permissionIds must be an array',
        })
        .min(1, 'At least one permission ID must be provided'),
    }),
  })
);

// ─── Remove permission from role ─────────────────────────────────────────────

export const rolePermissionIdSchema = roleAndPermissionIdParams;

// ─── View role permissions ────────────────────────────────────────────────────

export const roleIdSchema = roleIdParam;

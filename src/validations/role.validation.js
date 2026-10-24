// src/validations/role.validation.js
// Zod schemas for Role CRUD request validation.

import { z } from 'zod';

// ─── Shared field definitions ─────────────────────────────────────────────────

const nameField = z
  .string({ required_error: 'Role name is required' })
  .trim()
  .toUpperCase()
  .min(2, 'Role name must be at least 2 characters')
  .max(50, 'Role name must not exceed 50 characters')
  .regex(
    /^[A-Z][A-Z0-9_]*$/,
    'Role name must start with a letter and contain only uppercase letters, digits, or underscores (e.g. ADMIN, SUPER_ADMIN)'
  );

const descriptionField = z
  .string()
  .trim()
  .max(255, 'Description must not exceed 255 characters')
  .optional();

// ─── ID param ─────────────────────────────────────────────────────────────────

const idParam = z.object({
  params: z.object({
    id: z
      .string({ required_error: 'Role ID is required' })
      .min(1, 'Role ID must not be empty'),
  }),
});

// ─── Create Role ──────────────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  body: z.object({
    name: nameField,
    description: descriptionField,
  }),
});

// ─── Update Role ──────────────────────────────────────────────────────────────
// At least one field must be provided — we enforce this with .refine().

export const updateRoleSchema = idParam.merge(
  z.object({
    body: z
      .object({
        name: nameField.optional(),
        description: descriptionField,
      })
      .refine(
        (data) => Object.values(data).some((v) => v !== undefined),
        { message: 'At least one field (name or description) must be provided for update' }
      ),
  })
);

// ─── Single role by ID ────────────────────────────────────────────────────────

export const roleIdSchema = idParam;

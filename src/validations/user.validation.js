// src/validations/user.validation.js
// Zod schemas for User Management request validation.

import { z } from 'zod';

// ─── Shared field definitions ─────────────────────────────────────────────────

const emailField = z
  .string({ required_error: 'Email is required' })
  .email('Must be a valid email address')
  .toLowerCase()
  .trim();

const passwordField = (label = 'Password') =>
  z
    .string({ required_error: `${label} is required` })
    .min(8, `${label} must be at least 8 characters`)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      `${label} must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)`
    );

// ─── ID param ─────────────────────────────────────────────────────────────────

const idParam = z.object({
  params: z.object({
    id: z
      .string({ required_error: 'User ID is required' })
      .min(1, 'User ID must not be empty'),
  }),
});

// ─── Pagination / filtering query params ─────────────────────────────────────

export const listUsersSchema = z.object({
  query: z.object({
    // Page number (1-indexed), defaults to 1
    page: z.coerce
      .number({ invalid_type_error: 'page must be a number' })
      .int('page must be an integer')
      .min(1, 'page must be at least 1')
      .default(1),

    // Items per page, defaults to 20, capped at 100
    limit: z.coerce
      .number({ invalid_type_error: 'limit must be a number' })
      .int('limit must be an integer')
      .min(1, 'limit must be at least 1')
      .max(100, 'limit must not exceed 100')
      .default(20),

    // Optional role name filter (e.g. ?role=ADMIN)
    role: z.string().trim().toUpperCase().optional(),
  }),
});

// ─── Single user by ID (admin) ────────────────────────────────────────────────

export const userIdSchema = idParam;

// ─── Assign role to a user ────────────────────────────────────────────────────

export const assignRoleSchema = idParam.merge(
  z.object({
    body: z.object({
      roleId: z
        .string({ required_error: 'roleId is required' })
        .min(1, 'roleId must not be empty'),
    }),
  })
);

// ─── Update own profile (email) ───────────────────────────────────────────────

export const updateMeSchema = z.object({
  body: z
    .object({
      email: emailField.optional(),
    })
    .refine(
      (data) => Object.values(data).some((v) => v !== undefined),
      { message: 'At least one field (email) must be provided for update' }
    ),
});

// ─── Change own password ──────────────────────────────────────────────────────

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z
        .string({ required_error: 'Current password is required' })
        .min(1, 'Current password is required'),
      newPassword: passwordField('New password'),
      confirmPassword: z
        .string({ required_error: 'Confirm password is required' })
        .min(1, 'Confirm password is required'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'New password must be different from current password',
      path: ['newPassword'],
    }),
});

// ─── Update user status (activate / deactivate) ───────────────────────────────

export const updateStatusSchema = idParam.merge(
  z.object({
    body: z.object({
      isActive: z.boolean({ required_error: 'isActive is required', invalid_type_error: 'isActive must be a boolean' }),
    }),
  })
);

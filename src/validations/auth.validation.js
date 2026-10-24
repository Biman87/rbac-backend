// src/validations/auth.validation.js
// Zod schemas for auth-related request bodies.

import { z } from 'zod';

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Must be a valid email address')
      .toLowerCase()
      .trim(),

    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
      ),

    // roleName is optional — the controller defaults to "CUSTOMER" when omitted.
    // Providing a name lets an admin seed other roles during registration.
    roleName: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, 'Role name must be at least 2 characters')
      .optional(),
  }),
});

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Must be a valid email address')
      .toLowerCase()
      .trim(),

    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
  }),
});

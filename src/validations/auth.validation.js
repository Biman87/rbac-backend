// src/validations/auth.validation.js
// Zod schemas for all auth-related request bodies.

import { z } from 'zod';

// ─── Shared ───────────────────────────────────────────────────────────────────

const strongPassword = (label = 'Password') =>
  z
    .string({ required_error: `${label} is required` })
    .min(8, `${label} must be at least 8 characters`)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      `${label} must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)`
    );

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Must be a valid email address')
      .toLowerCase()
      .trim(),
    password: strongPassword(),
    roleName: z.string().trim().toUpperCase().min(2).optional(),
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

// ─── Forgot password ──────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Must be a valid email address')
      .toLowerCase()
      .trim(),
  }),
});

// ─── Reset password ───────────────────────────────────────────────────────────

export const resetPasswordSchema = z.object({
  params: z.object({
    token: z.string({ required_error: 'Reset token is required' }).min(1),
  }),
  body: z
    .object({
      password:        strongPassword('New password'),
      confirmPassword: z.string({ required_error: 'Confirm password is required' }).min(1),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: 'Passwords do not match',
      path:    ['confirmPassword'],
    }),
});

// ─── Resend verification email ────────────────────────────────────────────────

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Must be a valid email address')
      .toLowerCase()
      .trim(),
  }),
});

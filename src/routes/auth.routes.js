// src/routes/auth.routes.js

import { Router } from 'express';
import { validate }        from '../middlewares/validate.js';
import { protect }         from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/security.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} from '../validations/auth.validation.js';
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from '../controllers/auth.controller.js';

const router = Router();

// ── Core auth ─────────────────────────────────────────────────────────────────
router.post('/register', authRateLimiter, validate(registerSchema),  register);
router.post('/login',    authRateLimiter, validate(loginSchema),     login);
router.post('/logout',   logout);
router.post('/refresh',  refresh);                  // uses refreshToken cookie — no body needed
router.get ('/me',       protect, getMe);

// ── Email verification ────────────────────────────────────────────────────────
router.get ('/verify-email/:token',  verifyEmail);
router.post('/resend-verification',  authRateLimiter, validate(resendVerificationSchema), resendVerification);

// ── Password reset ────────────────────────────────────────────────────────────
router.post ('/forgot-password',         authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.patch('/reset-password/:token',   authRateLimiter, validate(resetPasswordSchema),  resetPassword);

export default router;

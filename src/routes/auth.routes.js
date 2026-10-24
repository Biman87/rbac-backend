// src/routes/auth.routes.js

import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/security.js';
import { registerSchema, loginSchema } from '../validations/auth.validation.js';
import {
  register,
  login,
  logout,
  getMe,
} from '../controllers/auth.controller.js';

const router = Router();

// POST /api/v1/auth/register  — strict rate limit (20 req / 15 min per IP)
router.post('/register', authRateLimiter, validate(registerSchema), register);

// POST /api/v1/auth/login     — strict rate limit
router.post('/login', authRateLimiter, validate(loginSchema), login);

// POST /api/v1/auth/logout
router.post('/logout', logout);

// GET /api/v1/auth/me  (protected)
router.get('/me', protect, getMe);

export default router;

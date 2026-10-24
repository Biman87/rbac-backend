// src/routes/index.js
// Central router — mounts all feature routers under their versioned prefixes.

import { Router } from 'express';
import authRoutes       from './auth.routes.js';
import roleRoutes       from './role.routes.js';
import userRoutes       from './user.routes.js';
import permissionRoutes from './permission.routes.js';
import adminRoutes      from './admin.routes.js';

const router = Router();

router.use('/auth',        authRoutes);
router.use('/roles',       roleRoutes);       // includes /:id/permissions sub-routes
router.use('/users',       userRoutes);
router.use('/permissions', permissionRoutes);
router.use('/admin',       adminRoutes);

// ── Health check (unauthenticated) ───────────────────────────────────────────
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;

// src/tests/setup.js
// Global test setup — runs once before the entire test suite via vitest's
// setupFiles config. Handles env loading and Prisma client lifecycle.

import 'dotenv/config';
import { afterAll } from 'vitest';
import prisma from '../config/prisma.js';

// Disconnect Prisma after all tests complete so the process exits cleanly
afterAll(async () => {
  await prisma.$disconnect();
});

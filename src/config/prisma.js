// src/config/prisma.js
// Prisma Client singleton — prevents multiple instances in development
// where Node.js module cache is not reliable across hot-reloads.

import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['query', 'info', 'warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export default prisma;

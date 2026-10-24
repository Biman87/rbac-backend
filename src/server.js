// src/server.js
// Entry point — boots the HTTP server and connects to the database.
// Handles graceful shutdown on SIGTERM / SIGINT.

import './config/env.js';  // Validates env vars at startup — fail fast
import app from './app.js';
import { env } from './config/env.js';
import prisma from './config/prisma.js';

// ─── Database connectivity check ──────────────────────────────────────────────
async function connectDatabase() {
  await prisma.$connect();
  console.log('✅  Database connected');
}

// ─── Start Server ─────────────────────────────────────────────────────────────
async function startServer() {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀  Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`📡  API base URL: http://localhost:${env.PORT}/api/v1`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal) {
    console.log(`\n⚠️   ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('💤  Database disconnected. Process exiting.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // ─── Unhandled Rejections / Exceptions ─────────────────────────────────────
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION 💥:', err.name, err.message);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(1);
    });
  });

  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION 💥:', err.name, err.message);
    process.exit(1);
  });
}

startServer();

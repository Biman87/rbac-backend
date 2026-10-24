// src/tests/helpers.js
// Shared test utilities: database helpers, fixture factories, and
// a supertest agent factory that handles cookie-based auth.

import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import app from '../app.js';
import prisma from '../config/prisma.js';

// ─── Supertest agent ──────────────────────────────────────────────────────────

/** Pre-built supertest agent (reuses one HTTP server per test file). */
export const agent = supertest(app);

// ─── Role helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the existing role by name, or creates it if missing.
 * Avoids P2002 conflicts when tests run against a pre-seeded DB.
 */
export async function findOrCreateRole(name, description = '') {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name, description },
  });
}

// ─── User factory ─────────────────────────────────────────────────────────────

/**
 * Creates a test user directly via Prisma (bypasses the API).
 * Automatically resolves the role by name.
 *
 * @param {{ email?: string, password?: string, roleName?: string }} opts
 * @returns {Promise<{ user: object, plainPassword: string }>}
 */
export async function createTestUser({
  email = `test_${Date.now()}@example.com`,
  password = 'Test@1234',
  roleName = 'CUSTOMER',
} = {}) {
  const role = await findOrCreateRole(roleName);
  const hashed = await bcrypt.hash(password, 10); // lower cost for speed in tests

  const user = await prisma.user.create({
    data: { email, password: hashed, roleId: role.id },
    include: { role: true },
  });

  return { user, plainPassword: password };
}

// ─── Auth cookie helper ───────────────────────────────────────────────────────

/**
 * Logs in a user via the API and returns the Set-Cookie header string
 * so subsequent supertest requests can attach it.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>} raw cookie header value
 */
export async function loginAndGetCookie(email, password) {
  const res = await agent.post('/api/v1/auth/login').send({ email, password });
  const cookie = res.headers['set-cookie'];
  if (!cookie) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  // supertest returns an array; join in case of multiple Set-Cookie headers
  return Array.isArray(cookie) ? cookie.join('; ') : cookie;
}

// ─── Cleanup helpers ──────────────────────────────────────────────────────────

/**
 * Deletes test users whose email matches a given pattern.
 * Call in afterEach / afterAll to keep the DB clean between test runs.
 */
export async function cleanupUsers(emailPattern) {
  await prisma.user.deleteMany({
    where: { email: { contains: emailPattern } },
  });
}

/**
 * Deletes test roles whose name matches a given pattern.
 */
export async function cleanupRoles(namePattern) {
  await prisma.role.deleteMany({
    where: { name: { contains: namePattern } },
  });
}

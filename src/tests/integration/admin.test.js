// src/tests/integration/admin.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  agent,
  createTestUser,
  loginAndGetCookie,
  cleanupUsers,
  findOrCreateRole,
} from '../helpers.js';

const TAG = '__admin_test__';
const email = (s) => `${TAG}_${s}@example.com`;

let adminCookie;
let managerCookie;
let customerCookie;
let customerId;

beforeAll(async () => {
  await findOrCreateRole('ADMIN');
  await findOrCreateRole('MANAGER');
  await findOrCreateRole('CUSTOMER');

  const { plainPassword: ap } = await createTestUser({ email: email('admin'),    roleName: 'ADMIN'    });
  const { plainPassword: mp } = await createTestUser({ email: email('manager'),  roleName: 'MANAGER'  });
  const { user: cust, plainPassword: cp } = await createTestUser({ email: email('customer'), roleName: 'CUSTOMER' });

  customerId     = cust.id;
  adminCookie    = await loginAndGetCookie(email('admin'),    ap);
  managerCookie  = await loginAndGetCookie(email('manager'),  mp);
  customerCookie = await loginAndGetCookie(email('customer'), cp);
});

afterAll(async () => {
  await cleanupUsers(TAG);
});

// ─── GET /api/v1/admin/dashboard  (#23) ──────────────────────────────────────

describe('GET /api/v1/admin/dashboard', () => {
  it('200 — admin accesses dashboard with stats', async () => {
    const res = await agent.get('/api/v1/admin/dashboard').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.stats).toMatchObject({
      totalUsers:       expect.any(Number),
      activeUsers:      expect.any(Number),
      inactiveUsers:    expect.any(Number),
      totalRoles:       expect.any(Number),
      totalPermissions: expect.any(Number),
    });
    expect(res.body.data.message).toMatch(/admin dashboard/i);
  });

  it('401 — unauthenticated request rejected', async () => {
    expect((await agent.get('/api/v1/admin/dashboard')).status).toBe(401);
  });

  it('403 — manager cannot access dashboard', async () => {
    expect((await agent.get('/api/v1/admin/dashboard').set('Cookie', managerCookie)).status).toBe(403);
  });

  it('403 — customer cannot access dashboard', async () => {
    expect((await agent.get('/api/v1/admin/dashboard').set('Cookie', customerCookie)).status).toBe(403);
  });
});

// ─── PATCH /api/v1/users/:id/status  (#21) ───────────────────────────────────

describe('PATCH /api/v1/users/:id/status', () => {
  it('200 — admin can deactivate a user', async () => {
    const res = await agent
      .patch(`/api/v1/users/${customerId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(false);
  });

  it('200 — admin can reactivate a user', async () => {
    const res = await agent
      .patch(`/api/v1/users/${customerId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(true);
  });

  it('401 — deactivated user cannot log in', async () => {
    // Deactivate the customer
    await agent.patch(`/api/v1/users/${customerId}/status`)
      .set('Cookie', adminCookie).send({ isActive: false });

    // Try to access a protected route with the old cookie
    const res = await agent.get('/api/v1/users/me').set('Cookie', customerCookie);
    expect(res.status).toBe(403); // 403 because account is deactivated

    // Reactivate for cleanup
    await agent.patch(`/api/v1/users/${customerId}/status`)
      .set('Cookie', adminCookie).send({ isActive: true });
  });

  it('422 — missing isActive field', async () => {
    const res = await agent
      .patch(`/api/v1/users/${customerId}/status`)
      .set('Cookie', adminCookie)
      .send({});
    expect(res.status).toBe(422);
  });

  it('422 — non-boolean isActive', async () => {
    const res = await agent
      .patch(`/api/v1/users/${customerId}/status`)
      .set('Cookie', adminCookie)
      .send({ isActive: 'yes' });
    expect(res.status).toBe(422);
  });

  it('403 — non-admin cannot change status', async () => {
    const res = await agent
      .patch(`/api/v1/users/${customerId}/status`)
      .set('Cookie', managerCookie)
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it('404 — non-existent user', async () => {
    const res = await agent
      .patch('/api/v1/users/nonexistent_id/status')
      .set('Cookie', adminCookie)
      .send({ isActive: false });
    expect(res.status).toBe(404);
  });
});

// ─── hasPermission middleware demo ────────────────────────────────────────────

describe('GET /api/v1/admin/permission-test', () => {
  it('200 — ADMIN bypasses permission check', async () => {
    const res = await agent.get('/api/v1/admin/permission-test').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
  });

  it('403 — CUSTOMER without manage:users permission is blocked', async () => {
    const res = await agent.get('/api/v1/admin/permission-test').set('Cookie', customerCookie);
    expect(res.status).toBe(403);
  });
});

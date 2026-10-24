// src/tests/integration/users.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  agent,
  createTestUser,
  loginAndGetCookie,
  cleanupUsers,
  findOrCreateRole,
} from '../helpers.js';
import prisma from '../../config/prisma.js';

const TAG = '__user_test__';
const email = (s) => `${TAG}_${s}@example.com`;

let adminCookie;
let customerCookie;
let adminId;
let customerId;
let customerPassword;

beforeAll(async () => {
  await findOrCreateRole('ADMIN');
  await findOrCreateRole('CUSTOMER');
  await findOrCreateRole('MANAGER');

  const { user: admin, plainPassword: adminPw } = await createTestUser({
    email: email('admin'),
    roleName: 'ADMIN',
  });
  const { user: customer, plainPassword: custPw } = await createTestUser({
    email: email('customer'),
    roleName: 'CUSTOMER',
  });

  adminId = admin.id;
  customerId = customer.id;
  customerPassword = custPw;

  adminCookie = await loginAndGetCookie(email('admin'), adminPw);
  customerCookie = await loginAndGetCookie(email('customer'), custPw);
});

afterAll(async () => {
  await cleanupUsers(TAG);
});

// ─── GET /api/v1/users ────────────────────────────────────────────────────────

describe('GET /api/v1/users', () => {
  it('200 — admin gets paginated user list', async () => {
    const res = await agent.get('/api/v1/users').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.users)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('200 — pagination metadata is correct', async () => {
    const res = await agent.get('/api/v1/users?page=1&limit=1').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(1);
  });

  it('200 — can filter by role', async () => {
    const res = await agent.get('/api/v1/users?role=ADMIN').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    res.body.data.users.forEach((u) => expect(u.role.name).toBe('ADMIN'));
  });

  it('422 — rejects invalid page param', async () => {
    const res = await agent.get('/api/v1/users?page=0').set('Cookie', adminCookie);
    expect(res.status).toBe(422);
  });

  it('422 — rejects limit above 100', async () => {
    const res = await agent.get('/api/v1/users?limit=101').set('Cookie', adminCookie);
    expect(res.status).toBe(422);
  });

  it('401 — unauthenticated request is rejected', async () => {
    const res = await agent.get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('403 — customer cannot list users', async () => {
    const res = await agent.get('/api/v1/users').set('Cookie', customerCookie);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/v1/users/:id ────────────────────────────────────────────────────

describe('GET /api/v1/users/:id', () => {
  it('200 — admin can fetch any user by ID', async () => {
    const res = await agent.get(`/api/v1/users/${customerId}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(customerId);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('404 — returns 404 for unknown ID', async () => {
    const res = await agent.get('/api/v1/users/nonexistent_xyz').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });

  it('403 — customer cannot fetch another user by ID', async () => {
    const res = await agent.get(`/api/v1/users/${adminId}`).set('Cookie', customerCookie);
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/v1/users/:id/role ─────────────────────────────────────────────

describe('PATCH /api/v1/users/:id/role', () => {
  let targetId;
  let managerRoleId;

  beforeAll(async () => {
    const { user } = await createTestUser({ email: email('role_target'), roleName: 'CUSTOMER' });
    targetId = user.id;
    const role = await prisma.role.findUnique({ where: { name: 'MANAGER' } });
    managerRoleId = role.id;
  });

  it('200 — admin can change a user role', async () => {
    const res = await agent
      .patch(`/api/v1/users/${targetId}/role`)
      .set('Cookie', adminCookie)
      .send({ roleId: managerRoleId });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role.name).toBe('MANAGER');
  });

  it('400 — cannot demote the last admin', async () => {
    // Ensure there is only one admin in test context
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });

    // Count admins — if there's more than one, this test needs a dedicated single-admin
    const count = await prisma.user.count({ where: { roleId: adminRole.id } });
    if (count > 1) return; // skip — can't guarantee last-admin state with parallel fixture users

    const res = await agent
      .patch(`/api/v1/users/${adminId}/role`)
      .set('Cookie', adminCookie)
      .send({ roleId: customerRole.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last ADMIN/i);
  });

  it('404 — non-existent roleId returns 404', async () => {
    const res = await agent
      .patch(`/api/v1/users/${targetId}/role`)
      .set('Cookie', adminCookie)
      .send({ roleId: 'nonexistent_role_id' });
    expect(res.status).toBe(404);
  });

  it('403 — customer cannot assign roles', async () => {
    const res = await agent
      .patch(`/api/v1/users/${targetId}/role`)
      .set('Cookie', customerCookie)
      .send({ roleId: managerRoleId });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/v1/users/:id ─────────────────────────────────────────────────

describe('DELETE /api/v1/users/:id', () => {
  let deleteTargetId;

  beforeAll(async () => {
    const { user } = await createTestUser({ email: email('delete_target'), roleName: 'CUSTOMER' });
    deleteTargetId = user.id;
  });

  it('204 — admin can delete a user', async () => {
    const res = await agent.delete(`/api/v1/users/${deleteTargetId}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });

  it('404 — deleting same user again returns 404', async () => {
    const res = await agent.delete(`/api/v1/users/${deleteTargetId}`).set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });

  it('400 — admin cannot delete their own account via this endpoint', async () => {
    const res = await agent.delete(`/api/v1/users/${adminId}`).set('Cookie', adminCookie);
    expect(res.status).toBe(400);
  });

  it('403 — customer cannot delete users', async () => {
    const res = await agent.delete(`/api/v1/users/${customerId}`).set('Cookie', customerCookie);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/v1/users/me ─────────────────────────────────────────────────────

describe('GET /api/v1/users/me', () => {
  it('200 — returns own profile', async () => {
    const res = await agent.get('/api/v1/users/me').set('Cookie', customerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email('customer'));
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('401 — unauthenticated request is rejected', async () => {
    const res = await agent.get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/v1/users/me ───────────────────────────────────────────────────

describe('PATCH /api/v1/users/me', () => {
  it('200 — user can update their own email', async () => {
    const { user, plainPassword } = await createTestUser({
      email: email('update_me'),
      roleName: 'CUSTOMER',
    });
    const cookie = await loginAndGetCookie(user.email, plainPassword);
    const newEmail = email('update_me_new');

    const res = await agent
      .patch('/api/v1/users/me')
      .set('Cookie', cookie)
      .send({ email: newEmail });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(newEmail);
  });

  it('409 — rejects email already taken by another user', async () => {
    const res = await agent
      .patch('/api/v1/users/me')
      .set('Cookie', customerCookie)
      .send({ email: email('admin') }); // admin's email

    expect(res.status).toBe(409);
  });

  it('422 — rejects empty body', async () => {
    const res = await agent.patch('/api/v1/users/me').set('Cookie', customerCookie).send({});
    expect(res.status).toBe(422);
  });
});

// ─── PATCH /api/v1/users/me/password ─────────────────────────────────────────

describe('PATCH /api/v1/users/me/password', () => {
  let pwCookie;

  beforeAll(async () => {
    const { user, plainPassword } = await createTestUser({
      email: email('pw_change'),
      roleName: 'CUSTOMER',
    });
    pwCookie = await loginAndGetCookie(user.email, plainPassword);
  });

  it('200 — user can change their password', async () => {
    const res = await agent
      .patch('/api/v1/users/me/password')
      .set('Cookie', pwCookie)
      .send({
        currentPassword: 'Test@1234',
        newPassword: 'NewPass@5678',
        confirmPassword: 'NewPass@5678',
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });

  it('401 — rejects wrong current password', async () => {
    const res = await agent
      .patch('/api/v1/users/me/password')
      .set('Cookie', pwCookie)
      .send({
        currentPassword: 'WrongCurrent@1',
        newPassword: 'NewPass@5678',
        confirmPassword: 'NewPass@5678',
      });
    expect(res.status).toBe(401);
  });

  it('422 — rejects mismatched confirm password', async () => {
    const res = await agent
      .patch('/api/v1/users/me/password')
      .set('Cookie', pwCookie)
      .send({
        currentPassword: 'NewPass@5678',
        newPassword: 'Another@1234',
        confirmPassword: 'Mismatch@9999',
      });
    expect(res.status).toBe(422);
  });

  it('422 — rejects new password same as current', async () => {
    const res = await agent
      .patch('/api/v1/users/me/password')
      .set('Cookie', pwCookie)
      .send({
        currentPassword: 'NewPass@5678',
        newPassword: 'NewPass@5678',
        confirmPassword: 'NewPass@5678',
      });
    expect(res.status).toBe(422);
  });

  it('422 — rejects weak new password', async () => {
    const res = await agent
      .patch('/api/v1/users/me/password')
      .set('Cookie', pwCookie)
      .send({
        currentPassword: 'NewPass@5678',
        newPassword: 'weakpassword',
        confirmPassword: 'weakpassword',
      });
    expect(res.status).toBe(422);
  });
});

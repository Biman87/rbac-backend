// src/tests/integration/roles.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  agent,
  createTestUser,
  loginAndGetCookie,
  cleanupUsers,
  cleanupRoles,
  findOrCreateRole,
} from '../helpers.js';

const TAG = '__role_test__';
const email = (s) => `${TAG}_${s}@example.com`;
const roleName = (s) => `ROLE_TEST_${s.toUpperCase()}`;

let adminCookie;
let customerCookie;

beforeAll(async () => {
  await findOrCreateRole('ADMIN');
  await findOrCreateRole('CUSTOMER');

  const { plainPassword: adminPw } = await createTestUser({
    email: email('admin'),
    roleName: 'ADMIN',
  });
  const { plainPassword: custPw } = await createTestUser({
    email: email('customer'),
    roleName: 'CUSTOMER',
  });

  adminCookie = await loginAndGetCookie(email('admin'), adminPw);
  customerCookie = await loginAndGetCookie(email('customer'), custPw);
});

afterAll(async () => {
  await cleanupUsers(TAG);
  await cleanupRoles('ROLE_TEST_');
});

// ─── GET /api/v1/roles ────────────────────────────────────────────────────────

describe('GET /api/v1/roles', () => {
  it('200 — admin can list all roles', async () => {
    const res = await agent.get('/api/v1/roles').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.roles)).toBe(true);
  });

  it('401 — unauthenticated request is rejected', async () => {
    const res = await agent.get('/api/v1/roles');
    expect(res.status).toBe(401);
  });

  it('403 — non-admin is forbidden', async () => {
    const res = await agent.get('/api/v1/roles').set('Cookie', customerCookie);
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/v1/roles ───────────────────────────────────────────────────────

describe('POST /api/v1/roles', () => {
  it('201 — admin can create a new role', async () => {
    const res = await agent
      .post('/api/v1/roles')
      .set('Cookie', adminCookie)
      .send({ name: roleName('create_ok'), description: 'Test role' });

    expect(res.status).toBe(201);
    expect(res.body.data.role.name).toBe(roleName('create_ok'));
  });

  it('409 — duplicate role name is rejected', async () => {
    const name = roleName('dup');
    await agent.post('/api/v1/roles').set('Cookie', adminCookie).send({ name });
    const res = await agent.post('/api/v1/roles').set('Cookie', adminCookie).send({ name });
    expect(res.status).toBe(409);
  });

  it('422 — missing name is rejected', async () => {
    const res = await agent
      .post('/api/v1/roles')
      .set('Cookie', adminCookie)
      .send({ description: 'No name' });
    expect(res.status).toBe(422);
  });

  it('422 — name with invalid characters is rejected', async () => {
    const res = await agent
      .post('/api/v1/roles')
      .set('Cookie', adminCookie)
      .send({ name: 'invalid-name' });
    expect(res.status).toBe(422);
  });

  it('403 — non-admin cannot create a role', async () => {
    const res = await agent
      .post('/api/v1/roles')
      .set('Cookie', customerCookie)
      .send({ name: roleName('no_perm') });
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/v1/roles/:id ────────────────────────────────────────────────────

describe('GET /api/v1/roles/:id', () => {
  let roleId;

  beforeAll(async () => {
    const res = await agent
      .post('/api/v1/roles')
      .set('Cookie', adminCookie)
      .send({ name: roleName('get_single') });
    roleId = res.body.data.role.id;
  });

  it('200 — returns the role', async () => {
    const res = await agent.get(`/api/v1/roles/${roleId}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.role.id).toBe(roleId);
  });

  it('404 — returns 404 for a non-existent ID', async () => {
    const res = await agent.get('/api/v1/roles/nonexistent_id_abc').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/roles/:id ──────────────────────────────────────────────────

describe('PATCH /api/v1/roles/:id', () => {
  let roleId;

  beforeAll(async () => {
    const res = await agent
      .post('/api/v1/roles')
      .set('Cookie', adminCookie)
      .send({ name: roleName('patch_me') });
    roleId = res.body.data.role.id;
  });

  it('200 — admin can update description', async () => {
    const res = await agent
      .patch(`/api/v1/roles/${roleId}`)
      .set('Cookie', adminCookie)
      .send({ description: 'Updated description' });
    expect(res.status).toBe(200);
    expect(res.body.data.role.description).toBe('Updated description');
  });

  it('422 — sending empty body is rejected', async () => {
    const res = await agent
      .patch(`/api/v1/roles/${roleId}`)
      .set('Cookie', adminCookie)
      .send({});
    expect(res.status).toBe(422);
  });

  it('404 — updating non-existent role returns 404', async () => {
    const res = await agent
      .patch('/api/v1/roles/nonexistent_id')
      .set('Cookie', adminCookie)
      .send({ description: 'x' });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/v1/roles/:id ─────────────────────────────────────────────────

describe('DELETE /api/v1/roles/:id', () => {
  it('204 — admin can delete an unassigned role', async () => {
    const create = await agent
      .post('/api/v1/roles')
      .set('Cookie', adminCookie)
      .send({ name: roleName('delete_me') });
    const id = create.body.data.role.id;

    const res = await agent.delete(`/api/v1/roles/${id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });

  it('400 — cannot delete a role still assigned to users', async () => {
    // CUSTOMER role is assigned to our test customer user
    const list = await agent.get('/api/v1/roles').set('Cookie', adminCookie);
    const customer = list.body.data.roles.find((r) => r.name === 'CUSTOMER');

    const res = await agent.delete(`/api/v1/roles/${customer.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(400);
  });

  it('404 — deleting non-existent role returns 404', async () => {
    const res = await agent.delete('/api/v1/roles/nonexistent_id').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});

// src/tests/integration/permissions.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  agent,
  createTestUser,
  loginAndGetCookie,
  cleanupUsers,
  findOrCreateRole,
} from '../helpers.js';
import prisma from '../../config/prisma.js';

const TAG = '__perm_test__';
const email  = (s) => `${TAG}_${s}@example.com`;
const pName  = (s) => `Test Permission ${TAG} ${s}`;

let adminCookie;
let customerCookie;

// Helpers
let _permCounter = 0;
function uniqueResource(tag) {
  return `${tag}_${++_permCounter}_${Date.now()}`.slice(0, 50).toLowerCase();
}

async function createPerm(cookie, overrides = {}) {
  const resource = overrides.resource ?? uniqueResource(TAG.replace(/__/g, '').toLowerCase());
  return agent.post('/api/v1/permissions').set('Cookie', cookie).send({
    name:     overrides.name     ?? pName(`${resource}_${_permCounter}`),
    action:   overrides.action   ?? 'read',
    resource,
    description: overrides.description,
  });
}

beforeAll(async () => {
  await findOrCreateRole('ADMIN');
  await findOrCreateRole('CUSTOMER');

  const { plainPassword: ap } = await createTestUser({ email: email('admin'),    roleName: 'ADMIN'    });
  const { plainPassword: cp } = await createTestUser({ email: email('customer'), roleName: 'CUSTOMER' });

  adminCookie    = await loginAndGetCookie(email('admin'),    ap);
  customerCookie = await loginAndGetCookie(email('customer'), cp);
});

afterAll(async () => {
  // Clean up test permissions
  await prisma.permission.deleteMany({ where: { name: { contains: TAG } } });
  await cleanupUsers(TAG);
});

// ─── GET /api/v1/permissions ──────────────────────────────────────────────────

describe('GET /api/v1/permissions', () => {
  it('200 — admin gets all permissions', async () => {
    const res = await agent.get('/api/v1/permissions').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
  });

  it('401 — unauthenticated', async () => {
    expect((await agent.get('/api/v1/permissions')).status).toBe(401);
  });

  it('403 — non-admin forbidden', async () => {
    expect((await agent.get('/api/v1/permissions').set('Cookie', customerCookie)).status).toBe(403);
  });
});

// ─── POST /api/v1/permissions ─────────────────────────────────────────────────

describe('POST /api/v1/permissions', () => {
  it('201 — admin creates a permission', async () => {
    const res = await createPerm(adminCookie, { name: pName('create_ok'), action: 'read', resource: 'permtest_r1' });
    expect(res.status).toBe(201);
    expect(res.body.data.permission.action).toBe('read');
  });

  it('409 — duplicate action+resource pair', async () => {
    const resource = 'permtest_dup';
    await createPerm(adminCookie, { name: pName('dup1'), action: 'read', resource });
    const res = await createPerm(adminCookie, { name: pName('dup2'), action: 'read', resource });
    expect(res.status).toBe(409);
  });

  it('422 — invalid action value', async () => {
    const res = await createPerm(adminCookie, { action: 'fly', resource: `${TAG}_bad` });
    expect(res.status).toBe(422);
  });

  it('422 — missing name', async () => {
    const res = await agent.post('/api/v1/permissions').set('Cookie', adminCookie)
      .send({ action: 'read', resource: `${TAG}_noname` });
    expect(res.status).toBe(422);
  });

  it('403 — non-admin cannot create', async () => {
    expect((await createPerm(customerCookie)).status).toBe(403);
  });
});

// ─── GET /api/v1/permissions/:id ──────────────────────────────────────────────

describe('GET /api/v1/permissions/:id', () => {
  let permId;
  beforeAll(async () => {
    const r = await createPerm(adminCookie, { name: pName('get_one'), action: 'read', resource: 'permtest_go' });
    permId = r.body.data.permission.id;
  });

  it('200 — admin gets a permission by ID', async () => {
    const res = await agent.get(`/api/v1/permissions/${permId}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.permission.id).toBe(permId);
  });

  it('404 — non-existent ID', async () => {
    expect((await agent.get('/api/v1/permissions/nonexistent').set('Cookie', adminCookie)).status).toBe(404);
  });
});

// ─── PATCH /api/v1/permissions/:id ────────────────────────────────────────────

describe('PATCH /api/v1/permissions/:id', () => {
  let permId;
  beforeAll(async () => {
    const r = await createPerm(adminCookie, { name: pName('patch_me'), action: 'read', resource: 'permtest_pm' });
    permId = r.body.data.permission.id;
  });

  it('200 — admin updates description', async () => {
    const res = await agent.patch(`/api/v1/permissions/${permId}`).set('Cookie', adminCookie)
      .send({ description: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.permission.description).toBe('Updated');
  });

  it('422 — empty body rejected', async () => {
    expect((await agent.patch(`/api/v1/permissions/${permId}`).set('Cookie', adminCookie).send({})).status).toBe(422);
  });

  it('404 — non-existent ID', async () => {
    expect((await agent.patch('/api/v1/permissions/nope').set('Cookie', adminCookie).send({ description: 'x' })).status).toBe(404);
  });
});

// ─── DELETE /api/v1/permissions/:id ──────────────────────────────────────────

describe('DELETE /api/v1/permissions/:id', () => {
  it('204 — admin deletes a permission', async () => {
    const r = await createPerm(adminCookie, { name: pName('del_me'), action: 'read', resource: 'permtest_dm' });
    const id = r.body.data.permission.id;
    expect((await agent.delete(`/api/v1/permissions/${id}`).set('Cookie', adminCookie)).status).toBe(204);
  });

  it('404 — deleting non-existent permission', async () => {
    expect((await agent.delete('/api/v1/permissions/nope').set('Cookie', adminCookie)).status).toBe(404);
  });
});

// ─── GET /api/v1/roles/:id/permissions ───────────────────────────────────────

describe('GET /api/v1/roles/:id/permissions', () => {
  let roleId;
  beforeAll(async () => {
    const r = await agent.get('/api/v1/roles').set('Cookie', adminCookie);
    roleId = r.body.data.roles[0].id;
  });

  it('200 — returns permissions for a role', async () => {
    const res = await agent.get(`/api/v1/roles/${roleId}/permissions`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
  });

  it('404 — non-existent role', async () => {
    expect((await agent.get('/api/v1/roles/nope/permissions').set('Cookie', adminCookie)).status).toBe(404);
  });
});

// ─── POST /api/v1/roles/:id/permissions ──────────────────────────────────────

describe('POST /api/v1/roles/:id/permissions', () => {
  let roleId, permId1, permId2;
  beforeAll(async () => {
    const roles = await agent.get('/api/v1/roles').set('Cookie', adminCookie);
    // Use the CUSTOMER role (has no permissions)
    roleId = roles.body.data.roles.find((r) => r.name === 'CUSTOMER')?.id;

    const [r1, r2] = await Promise.all([
      createPerm(adminCookie, { name: pName('assign1'), action: 'read',   resource: 'permtest_a1' }),
      createPerm(adminCookie, { name: pName('assign2'), action: 'create', resource: 'permtest_a2' }),
    ]);
    permId1 = r1.body.data.permission.id;
    permId2 = r2.body.data.permission.id;
  });

  it('200 — assigns permissions to a role', async () => {
    const res = await agent
      .post(`/api/v1/roles/${roleId}/permissions`)
      .set('Cookie', adminCookie)
      .send({ permissionIds: [permId1, permId2] });

    expect(res.status).toBe(200);
    const ids = res.body.data.permissions.map((p) => p.id);
    expect(ids).toContain(permId1);
    expect(ids).toContain(permId2);
  });

  it('200 — re-assigning existing permissions is idempotent', async () => {
    const res = await agent
      .post(`/api/v1/roles/${roleId}/permissions`)
      .set('Cookie', adminCookie)
      .send({ permissionIds: [permId1] });
    expect(res.status).toBe(200);
  });

  it('400 — non-existent permissionId', async () => {
    const res = await agent
      .post(`/api/v1/roles/${roleId}/permissions`)
      .set('Cookie', adminCookie)
      .send({ permissionIds: ['nonexistent_perm_id'] });
    expect(res.status).toBe(400);
  });

  it('422 — empty permissionIds array', async () => {
    const res = await agent
      .post(`/api/v1/roles/${roleId}/permissions`)
      .set('Cookie', adminCookie)
      .send({ permissionIds: [] });
    expect(res.status).toBe(422);
  });
});

// ─── DELETE /api/v1/roles/:id/permissions/:permissionId ──────────────────────

describe('DELETE /api/v1/roles/:id/permissions/:permissionId', () => {
  let roleId, permId;
  beforeAll(async () => {
    const roles = await agent.get('/api/v1/roles').set('Cookie', adminCookie);
    roleId = roles.body.data.roles.find((r) => r.name === 'CUSTOMER')?.id;

    const r = await createPerm(adminCookie, { name: pName('remove_me'), action: 'delete', resource: 'permtest_rm' });
    permId = r.body.data.permission.id;

    // Assign first
    await agent.post(`/api/v1/roles/${roleId}/permissions`).set('Cookie', adminCookie)
      .send({ permissionIds: [permId] });
  });

  it('204 — removes a permission from a role', async () => {
    const res = await agent
      .delete(`/api/v1/roles/${roleId}/permissions/${permId}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });

  it('404 — removing an already-removed permission', async () => {
    const res = await agent
      .delete(`/api/v1/roles/${roleId}/permissions/${permId}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});

// src/tests/integration/auth.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { agent, createTestUser, cleanupUsers, findOrCreateRole } from '../helpers.js';

// All test users share this tag so cleanup is scoped
const TAG = '__auth_test__';
const email = (suffix) => `${TAG}_${suffix}@example.com`;

beforeAll(async () => {
  // Ensure required roles exist
  await findOrCreateRole('CUSTOMER');
  await findOrCreateRole('ADMIN');
});

afterAll(async () => {
  await cleanupUsers(TAG);
});

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('201 — creates a user and sets an auth cookie', async () => {
    const res = await agent.post('/api/v1/auth/register').send({
      email: email('register_ok'),
      password: 'Test@1234',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user).toMatchObject({ email: email('register_ok') });
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('409 — rejects a duplicate email', async () => {
    const dup = email('register_dup');
    await agent.post('/api/v1/auth/register').send({ email: dup, password: 'Test@1234' });
    const res = await agent.post('/api/v1/auth/register').send({ email: dup, password: 'Test@1234' });
    expect(res.status).toBe(409);
  });

  it('422 — rejects a missing email', async () => {
    const res = await agent.post('/api/v1/auth/register').send({ password: 'Test@1234' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('422 — rejects a weak password', async () => {
    const res = await agent.post('/api/v1/auth/register').send({
      email: email('weak_pw'),
      password: 'password',
    });
    expect(res.status).toBe(422);
  });

  it('422 — rejects an invalid email format', async () => {
    const res = await agent.post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'Test@1234',
    });
    expect(res.status).toBe(422);
  });

  it('400 — rejects an unknown roleName', async () => {
    const res = await agent.post('/api/v1/auth/register').send({
      email: email('bad_role'),
      password: 'Test@1234',
      roleName: 'NONEXISTENT',
    });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  const loginEmail = email('login_user');
  const loginPassword = 'Login@1234';

  beforeAll(async () => {
    await createTestUser({ email: loginEmail, password: loginPassword, roleName: 'CUSTOMER' });
  });

  it('200 — returns user and sets auth cookie on valid credentials', async () => {
    const res = await agent.post('/api/v1/auth/login').send({
      email: loginEmail,
      password: loginPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.email).toBe(loginEmail);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('401 — rejects wrong password', async () => {
    const res = await agent.post('/api/v1/auth/login').send({
      email: loginEmail,
      password: 'WrongPass@99',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('401 — rejects non-existent email', async () => {
    const res = await agent.post('/api/v1/auth/login').send({
      email: email('nobody'),
      password: 'Test@1234',
    });
    expect(res.status).toBe(401);
  });

  it('422 — rejects missing password', async () => {
    const res = await agent.post('/api/v1/auth/login').send({ email: loginEmail });
    expect(res.status).toBe(422);
  });
});

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('200 — clears the cookie (no auth required)', async () => {
    const res = await agent.post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });
});

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  const meEmail = email('me_user');
  const mePassword = 'Me@12345';
  let cookie;

  beforeAll(async () => {
    await createTestUser({ email: meEmail, password: mePassword, roleName: 'CUSTOMER' });
    const res = await agent.post('/api/v1/auth/login').send({ email: meEmail, password: mePassword });
    cookie = res.headers['set-cookie'];
  });

  it('200 — returns the authenticated user profile', async () => {
    const res = await agent.get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(meEmail);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('401 — rejects requests without a cookie', async () => {
    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

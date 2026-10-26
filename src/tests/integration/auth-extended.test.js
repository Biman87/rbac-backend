// src/tests/integration/auth-extended.test.js
// Tests for: refresh token flow, email verification, and password reset.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import prisma  from '../../config/prisma.js';
import {
  agent,
  createTestUser,
  createUnverifiedUser,
  loginAndGetCookie,
  cleanupUsers,
  cleanupRefreshTokens,
  findOrCreateRole,
} from '../helpers.js';

const TAG   = '__auth_ext__';
const email = (s) => `${TAG}_${s}@example.com`;

beforeAll(async () => {
  await findOrCreateRole('CUSTOMER');
  await findOrCreateRole('ADMIN');
});

afterAll(async () => {
  await cleanupRefreshTokens(TAG);
  await cleanupUsers(TAG);
});

// ─── Refresh token flow ───────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  let refreshCookie;
  let accessCookie;

  beforeAll(async () => {
    const { plainPassword } = await createTestUser({ email: email('refresh_user') });
    const res = await agent.post('/api/v1/auth/login').send({
      email:    email('refresh_user'),
      password: plainPassword,
    });
    // Collect both cookies
    const cookies = res.headers['set-cookie'];
    accessCookie  = cookies.find((c) => c.startsWith('token='));
    refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
  });

  it('200 — issues a new access token using a valid refresh token', async () => {
    const res = await agent
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.headers['set-cookie']).toBeDefined();
    // Should set new token cookies
    const newCookies = res.headers['set-cookie'];
    expect(newCookies.some((c) => c.startsWith('token='))).toBe(true);
    expect(newCookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('401 — rejects when no refresh token cookie is present', async () => {
    const res = await agent.post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('401 — rejects a tampered / non-existent refresh token', async () => {
    const fake = 'refreshToken=fakehextoken1234567890abcdef; Path=/api/v1/auth/refresh; HttpOnly';
    const res  = await agent.post('/api/v1/auth/refresh').set('Cookie', fake);
    expect(res.status).toBe(401);
  });

  it('401 — old refresh token is revoked after rotation (token reuse prevention)', async () => {
    // Use the original refreshCookie — it was already rotated in the first test
    const res = await agent
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);
    expect(res.status).toBe(401);
  });
});

// ─── Logout revokes refresh token ─────────────────────────────────────────────

describe('POST /api/v1/auth/logout (refresh token revocation)', () => {
  let refreshCookie;

  beforeAll(async () => {
    const { plainPassword } = await createTestUser({ email: email('logout_user') });
    const res = await agent.post('/api/v1/auth/login').send({
      email:    email('logout_user'),
      password: plainPassword,
    });
    const cookies = res.headers['set-cookie'];
    refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
  });

  it('200 — logout succeeds', async () => {
    const res = await agent.post('/api/v1/auth/logout').set('Cookie', refreshCookie);
    expect(res.status).toBe(200);
  });

  it('401 — refresh token is revoked after logout', async () => {
    const res = await agent.post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(res.status).toBe(401);
  });
});

// ─── Email verification ───────────────────────────────────────────────────────

describe('GET /api/v1/auth/verify-email/:token', () => {
  it('200 — verifies email with a valid token and logs the user in', async () => {
    const { rawToken } = await createUnverifiedUser({ email: email('verify_ok') });

    const res = await agent.get(`/api/v1/auth/verify-email/${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.isEmailVerified).toBe(true);
    // Should set auth cookies
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('400 — rejects an invalid token', async () => {
    const res = await agent.get('/api/v1/auth/verify-email/invalidtoken123abc');
    expect(res.status).toBe(400);
  });

  it('400 — rejects an expired token', async () => {
    // Create user with an already-expired verification token
    const role = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
    const rawToken    = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.user.create({
      data: {
        email:                    email('verify_expired'),
        password:                 'hashed_irrelevant',
        roleId:                   role.id,
        isEmailVerified:          false,
        emailVerificationToken:   hashedToken,
        emailVerificationExpires: new Date(Date.now() - 1000), // already expired
      },
    });

    const res = await agent.get(`/api/v1/auth/verify-email/${rawToken}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/resend-verification', () => {
  it('200 — always returns 200 (prevents email enumeration)', async () => {
    const res = await agent
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'nonexistent@example.com' });
    expect(res.status).toBe(200);
  });

  it('200 — resends token for an unverified user', async () => {
    const { user } = await createUnverifiedUser({ email: email('resend_ok') });
    const res = await agent
      .post('/api/v1/auth/resend-verification')
      .send({ email: user.email });
    expect(res.status).toBe(200);
  });

  it('200 — silently ignores already-verified accounts', async () => {
    const { user } = await createTestUser({ email: email('resend_verified') });
    const res = await agent
      .post('/api/v1/auth/resend-verification')
      .send({ email: user.email });
    expect(res.status).toBe(200);
  });

  it('422 — rejects invalid email', async () => {
    const res = await agent
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

// ─── Login blocks unverified users ────────────────────────────────────────────

describe('POST /api/v1/auth/login (email verification enforcement)', () => {
  it('403 — blocks login for unverified email', async () => {
    const { user, plainPassword } = await createUnverifiedUser({
      email: email('login_unverified'),
    });
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: plainPassword });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify your email/i);
  });
});

// ─── Password reset ───────────────────────────────────────────────────────────

describe('POST /api/v1/auth/forgot-password', () => {
  it('200 — always responds 200 regardless of whether email exists', async () => {
    const res = await agent
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });

  it('200 — stores a reset token for an existing user', async () => {
    const { user } = await createTestUser({ email: email('forgot_ok') });

    const res = await agent
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email });

    expect(res.status).toBe(200);

    // Confirm token was stored in DB
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated.passwordResetToken).not.toBeNull();
    expect(updated.passwordResetExpires).not.toBeNull();
    expect(updated.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
  });

  it('422 — rejects invalid email format', async () => {
    const res = await agent
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/v1/auth/reset-password/:token', () => {
  let validRawToken;
  let testUserId;

  beforeAll(async () => {
    const { user } = await createTestUser({ email: email('reset_ok') });
    testUserId = user.id;

    // Inject a reset token directly via Prisma
    validRawToken     = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(validRawToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data:  {
        passwordResetToken:   hashedToken,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  });

  it('200 — resets password with a valid token', async () => {
    const res = await agent
      .patch(`/api/v1/auth/reset-password/${validRawToken}`)
      .send({ password: 'NewPass@9999', confirmPassword: 'NewPass@9999' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset successfully/i);

    // Confirm token was cleared
    const updated = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(updated.passwordResetToken).toBeNull();
  });

  it('200 — user can now log in with new password', async () => {
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: email('reset_ok'), password: 'NewPass@9999' });
    expect(res.status).toBe(200);
  });

  it('400 — rejects an invalid/expired token', async () => {
    const res = await agent
      .patch('/api/v1/auth/reset-password/completelywrongtokenvalue1234')
      .send({ password: 'NewPass@9999', confirmPassword: 'NewPass@9999' });
    expect(res.status).toBe(400);
  });

  it('422 — rejects mismatched confirm password', async () => {
    const res = await agent
      .patch(`/api/v1/auth/reset-password/sometoken`)
      .send({ password: 'NewPass@9999', confirmPassword: 'Different@1111' });
    expect(res.status).toBe(422);
  });

  it('422 — rejects weak password', async () => {
    const res = await agent
      .patch(`/api/v1/auth/reset-password/sometoken`)
      .send({ password: 'weakpassword', confirmPassword: 'weakpassword' });
    expect(res.status).toBe(422);
  });

  it('400 — rejects token reuse (token is cleared after first use)', async () => {
    // validRawToken was consumed in the first test
    const res = await agent
      .patch(`/api/v1/auth/reset-password/${validRawToken}`)
      .send({ password: 'AnotherNew@1234', confirmPassword: 'AnotherNew@1234' });
    expect(res.status).toBe(400);
  });
});

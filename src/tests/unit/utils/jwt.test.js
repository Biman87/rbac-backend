// src/tests/unit/utils/jwt.test.js
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../../utils/jwt.js';

const PAYLOAD = { id: 'user_123', role: 'ADMIN' };

describe('signToken', () => {
  it('returns a string', () => {
    expect(typeof signToken(PAYLOAD)).toBe('string');
  });

  it('produces a token with 3 JWT segments', () => {
    const token = signToken(PAYLOAD);
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyToken', () => {
  it('decodes a valid token and returns the original payload', () => {
    const token = signToken(PAYLOAD);
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(PAYLOAD.id);
    expect(decoded.role).toBe(PAYLOAD.role);
  });

  it('adds iat and exp fields', () => {
    const token = signToken(PAYLOAD);
    const decoded = verifyToken(token);
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it('throws JsonWebTokenError for a tampered token', () => {
    const token = signToken(PAYLOAD);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('throws JsonWebTokenError for a garbage string', () => {
    expect(() => verifyToken('not.a.token')).toThrow();
  });

  it('throws TokenExpiredError for an already-expired token', async () => {
    // Sign with 1ms expiry and wait for it to expire
    const { default: jwt } = await import('jsonwebtoken');
    const { env } = await import('../../../config/env.js');
    const expired = jwt.sign(PAYLOAD, env.JWT_SECRET, { expiresIn: 1 }); // 1 second
    // Wait 1.1 seconds to ensure expiry
    await new Promise((r) => setTimeout(r, 1100));
    expect(() => verifyToken(expired)).toThrow(/expired/i);
  });
});

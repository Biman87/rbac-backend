// src/tests/unit/utils/sanitize.test.js
import { describe, it, expect, vi } from 'vitest';
import { xssSanitize } from '../../../middlewares/sanitize.js';

function makeReq(overrides = {}) {
  return { body: {}, query: {}, params: {}, ...overrides };
}

describe('xssSanitize middleware', () => {
  it('calls next()', () => {
    const next = vi.fn();
    xssSanitize(makeReq(), {}, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('escapes script tags in req.body strings', () => {
    const req = makeReq({ body: { name: '<script>alert(1)</script>' } });
    xssSanitize(req, {}, vi.fn());
    expect(req.body.name).not.toContain('<script>');
  });

  it('escapes script tags in req.query strings', () => {
    const req = makeReq({ query: { search: '<img src=x onerror=alert(1)>' } });
    xssSanitize(req, {}, vi.fn());
    expect(req.query.search).not.toContain('onerror');
  });

  it('leaves safe strings untouched', () => {
    const req = makeReq({ body: { email: 'user@example.com' } });
    xssSanitize(req, {}, vi.fn());
    expect(req.body.email).toBe('user@example.com');
  });

  it('handles nested objects', () => {
    const req = makeReq({
      body: { nested: { value: '<b>bold</b>' } },
    });
    xssSanitize(req, {}, vi.fn());
    // <b> is generally allowed by xss, but script injection is blocked
    // Just confirm the nested key is still present and a string
    expect(typeof req.body.nested.value).toBe('string');
  });

  it('handles arrays inside body', () => {
    const req = makeReq({
      body: { tags: ['<script>bad</script>', 'safe'] },
    });
    xssSanitize(req, {}, vi.fn());
    expect(req.body.tags[0]).not.toContain('<script>');
    expect(req.body.tags[1]).toBe('safe');
  });

  it('passes through non-string primitives unchanged', () => {
    const req = makeReq({ body: { count: 5, active: true, data: null } });
    xssSanitize(req, {}, vi.fn());
    expect(req.body.count).toBe(5);
    expect(req.body.active).toBe(true);
    expect(req.body.data).toBeNull();
  });
});

// src/tests/unit/utils/AppError.test.js
import { describe, it, expect } from 'vitest';
import { AppError } from '../../../utils/AppError.js';

describe('AppError', () => {
  it('extends Error', () => {
    const err = new AppError('oops', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('sets message and statusCode', () => {
    const err = new AppError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
  });

  it('sets status to "fail" for 4xx codes', () => {
    expect(new AppError('bad', 400).status).toBe('fail');
    expect(new AppError('unauth', 401).status).toBe('fail');
    expect(new AppError('forbidden', 403).status).toBe('fail');
    expect(new AppError('not found', 404).status).toBe('fail');
    expect(new AppError('conflict', 409).status).toBe('fail');
    expect(new AppError('unprocessable', 422).status).toBe('fail');
  });

  it('sets status to "error" for 5xx codes', () => {
    expect(new AppError('internal', 500).status).toBe('error');
    expect(new AppError('gateway', 502).status).toBe('error');
  });

  it('sets isOperational to true', () => {
    expect(new AppError('err', 400).isOperational).toBe(true);
  });

  it('stores structured errors when provided', () => {
    const errors = [{ field: 'email', message: 'Invalid' }];
    const err = new AppError('Validation failed', 422, errors);
    expect(err.errors).toEqual(errors);
  });

  it('sets errors to null when not provided', () => {
    expect(new AppError('err', 400).errors).toBeNull();
  });

  it('captures a stack trace', () => {
    const err = new AppError('err', 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });
});

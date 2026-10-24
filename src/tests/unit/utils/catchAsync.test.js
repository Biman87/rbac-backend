// src/tests/unit/utils/catchAsync.test.js
import { describe, it, expect, vi } from 'vitest';
import { catchAsync } from '../../../utils/catchAsync.js';

describe('catchAsync', () => {
  it('calls the wrapped function with req, res, next', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const wrapped = catchAsync(fn);
    const [req, res, next] = [{}, {}, vi.fn()];

    await wrapped(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with the error when the wrapped function rejects', async () => {
    const error = new Error('async failure');
    const fn = vi.fn().mockRejectedValue(error);
    const wrapped = catchAsync(fn);
    const next = vi.fn();

    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('does not swallow synchronous errors thrown inside async fn', async () => {
    const error = new Error('sync throw inside async');
    const fn = vi.fn(async () => { throw error; });
    const wrapped = catchAsync(fn);
    const next = vi.fn();

    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

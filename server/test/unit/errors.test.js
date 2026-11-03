import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../src/middleware/errors.js';

function fakeResponse() {
  const res = { headersSent: false };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('errorHandler', () => {
  it('turns a malformed id from an internal caller into a 400', () => {
    const res = fakeResponse();
    const err = new mongoose.Error.CastError('ObjectId', 'not-an-id', 'slot');

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid slot.' });
  });

  it('hides the details of unexpected errors', () => {
    const res = fakeResponse();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(new Error('connection string leaked'), {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong. Please try again.' });
  });
});

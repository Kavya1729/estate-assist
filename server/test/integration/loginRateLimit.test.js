import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { useTestDatabase } from '../helpers/db.js';
import { DEFAULT_PASSWORD, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();

describe('login rate limiting', () => {
  it('blocks an IP after 10 failed attempts and does not count successful ones', async () => {
    await createStaff();
    const attempt = (password) =>
      request(app).post('/api/auth/login').send({ email: 'ravi@estate.test', password });

    for (let i = 0; i < 3; i += 1) {
      expect((await attempt(DEFAULT_PASSWORD)).status).toBe(200);
    }
    for (let i = 0; i < 10; i += 1) {
      expect((await attempt('wrong-password')).status).toBe(401);
    }

    const blocked = await attempt(DEFAULT_PASSWORD);

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many sign-in attempts/);
  });
});

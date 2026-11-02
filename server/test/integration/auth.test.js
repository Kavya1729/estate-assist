import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { ROLES } from '../../src/constants/domain.js';
import { requireAuth, requireRole } from '../../src/middleware/auth.js';
import { errorHandler } from '../../src/middleware/errors.js';
import { User } from '../../src/models/index.js';
import { useTestDatabase } from '../helpers/db.js';
import { DEFAULT_PASSWORD, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();

function login(email, password = DEFAULT_PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password });
}

describe('POST /api/auth/login', () => {
  it('returns a token and the user without the password hash', async () => {
    const staff = await createStaff();

    const res = await login('ravi@estate.test');

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ id: staff.id, role: ROLES.SALES_EXECUTIVE });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(jwt.decode(res.body.token)).toMatchObject({ sub: staff.id, role: staff.role });
  });

  it('ignores case and surrounding spaces in the email', async () => {
    await createStaff();

    const res = await login('  RAVI@Estate.test ');

    expect(res.status).toBe(200);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await createStaff();

    const wrongPassword = await login('ravi@estate.test', 'not-the-password');
    const unknownEmail = await login('nobody@estate.test');

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
  });

  it('refuses deactivated accounts', async () => {
    await createStaff({ isActive: false });

    const res = await login('ravi@estate.test');

    expect(res.status).toBe(403);
  });

  it('rejects invalid input with field-level details before touching the database', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        { field: 'body.email', message: 'Enter a valid email address' },
        { field: 'body.password', message: 'Enter your password' },
      ]),
    );
  });

  it('rejects non-string values such as query operators', async () => {
    await createStaff();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the signed-in user', async () => {
    const staff = await createStaff();
    const { body } = await login('ravi@estate.test');

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(staff.id);
  });

  it('requires a bearer token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    await createStaff();
    const { body } = await login('ravi@estate.test');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.token}x`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Please sign in to continue.');
  });

  it('tells the user when the session has expired', async () => {
    const staff = await createStaff();
    const expired = jwt.sign({ role: staff.role }, process.env.JWT_SECRET, {
      subject: staff.id,
      expiresIn: -10,
    });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/);
  });

  it('rejects a token signed with the "none" algorithm', async () => {
    const staff = await createStaff();
    const unsigned = jwt.sign({ role: ROLES.SALES_HEAD }, null, {
      subject: staff.id,
      algorithm: 'none',
    });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${unsigned}`);

    expect(res.status).toBe(401);
  });

  it('locks out a user deactivated after signing in', async () => {
    const staff = await createStaff();
    const { body } = await login('ravi@estate.test');
    await User.updateOne({ _id: staff.id }, { isActive: false });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(401);
  });
});

describe('requireRole', () => {
  const guarded = express();
  guarded.get('/head-only', requireAuth, requireRole(ROLES.SALES_HEAD), (_req, res) => {
    res.json({ ok: true });
  });
  guarded.use(errorHandler);

  async function tokenFor(role, email) {
    await createStaff({ role, email });
    const { body } = await login(email);
    return body.token;
  }

  it('allows the listed role', async () => {
    const token = await tokenFor(ROLES.SALES_HEAD, 'head@estate.test');

    const res = await request(guarded).get('/head-only').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('forbids other roles', async () => {
    const token = await tokenFor(ROLES.SALES_EXECUTIVE, 'exec@estate.test');

    const res = await request(guarded).get('/head-only').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('uses the current role from the database, not the one in the token', async () => {
    const token = await tokenFor(ROLES.SALES_HEAD, 'demoted@estate.test');
    await User.updateOne({ email: 'demoted@estate.test' }, { role: ROLES.SALES_EXECUTIVE });

    const res = await request(guarded).get('/head-only').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { useTestDatabase } from '../helpers/db.js';

useTestDatabase();

const FRONTEND = 'https://estate-assist.vercel.app';
const app = createApp({ clientOrigins: [FRONTEND, 'http://localhost:5173'] });

describe('security headers', () => {
  it('sends helmet headers and a lock-down CSP, and hides the framework', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('refuses request bodies over 100 kB', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'x'.repeat(120_000) });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Request body is too large.');
  });
});

describe('CORS allowlist', () => {
  it('allows a listed frontend and names it in the response', async () => {
    const res = await request(app).get('/api/health').set('Origin', FRONTEND);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(res.headers.vary).toMatch(/Origin/);
  });

  it('answers the preflight for an authorised JSON request', async () => {
    const res = await request(app)
      .options('/api/chat/messages')
      .set('Origin', FRONTEND)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('refuses any other website before the route runs', async () => {
    for (const origin of [
      'https://evil.example.com',
      'https://estate-assist.vercel.app.evil.com',
    ]) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: 'meera@example.com', password: 'Demo@12345' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not allowed/);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('lets requests without an Origin through (lead sources, health checks)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows no browser origin at all when none is configured', async () => {
    const res = await request(createApp()).get('/api/health').set('Origin', FRONTEND);
    expect(res.status).toBe(403);
  });
});

describe('chat rate limits', () => {
  it('stops a network after 20 chat messages a minute, before any LLM work', async () => {
    const statuses = [];
    for (let i = 0; i < 21; i += 1) {
      statuses.push((await request(app).post('/api/chat/messages').send({ text: 'hi' })).status);
    }

    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    const limited = await request(app).post('/api/chat/messages').send({ text: 'hi' });
    expect(statuses[20]).toBe(429);
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatch(/too quickly/);
    expect(limited.headers.ratelimit).toBeDefined();
  });

  it('stops a network after 20 new chats an hour', async () => {
    const statuses = [];
    for (let i = 0; i < 21; i += 1) {
      statuses.push((await request(app).post('/api/chat/sessions').send({})).status);
    }

    expect(statuses.slice(0, 20).every((s) => s === 400)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

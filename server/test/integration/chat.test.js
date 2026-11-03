import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { Conversation, Lead } from '../../src/models/index.js';
import { authHeader } from '../helpers/auth.js';
import { useTestDatabase } from '../helpers/db.js';
import { createProject, createSlot, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();
const buyer = { name: 'Nidhi Shah', phone: '97270 12345', projectCode: 'P2', consent: true };

let project;

beforeEach(async () => {
  project = await createProject({ code: 'P2', name: 'Project 2' });
});

async function start(body = buyer) {
  return request(app).post('/api/chat/sessions').send(body);
}

const send = (token, text) =>
  request(app).post('/api/chat/messages').set('Authorization', `Bearer ${token}`).send({ text });

describe('POST /api/chat/sessions', () => {
  it('creates the lead from the website and greets the buyer', async () => {
    const res = await start();

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.messages).toEqual([
      expect.objectContaining({
        role: 'assistant',
        text: expect.stringContaining('Hi Nidhi Shah'),
      }),
    ]);

    const lead = await Lead.findOne({ normalizedPhone: '9727012345' });
    expect(lead).toMatchObject({ primarySource: 'website', status: 'engaged' });
    expect(lead.firstResponseAt).toBeInstanceOf(Date);
  });

  it('merges into an existing lead, greets again and hides the earlier chat', async () => {
    const first = await start();
    await send(first.body.token, 'Hello');

    const second = await start();

    expect(await Lead.countDocuments()).toBe(1);
    expect(second.body.messages).toEqual([
      expect.objectContaining({
        role: 'assistant',
        text: expect.stringContaining('Hi Nidhi Shah'),
      }),
    ]);
  });

  it('requires consent and a valid phone', async () => {
    const res = await start({ name: 'Nidhi', phone: '12345', consent: false });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['body.consent', 'body.phone']);
  });
});

describe('chatting', () => {
  it('runs the assistant end to end with the demo provider', async () => {
    await createSlot(project);
    const { body } = await start();

    const facts = await send(body.token, 'What is the price of a 2 BHK?');
    expect(facts.status).toBe(200);
    expect(facts.body.reply.text).toContain('Project 2');
    expect(facts.body.reply.toolCalls).toBeUndefined();

    const slots = await send(body.token, 'Can I book a visit?');
    expect(slots.body.reply.text).toMatch(/Free slots: 1\)/);

    const booked = await send(body.token, '1');
    expect(booked.body.reply.text).toMatch(/^Done! Your site visit is booked/);
    expect((await Lead.findOne()).status).toBe('visit_booked');
  });

  it('returns the session history without tool internals', async () => {
    const { body } = await start();
    await send(body.token, 'What is the price?');

    const res = await request(app)
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${body.token}`);

    expect(res.body.messages.map((m) => m.role)).toEqual(['assistant', 'buyer', 'assistant']);
    expect(res.body.messages.every((m) => !('toolCalls' in m))).toBe(true);
    const stored = await Conversation.findOne();
    expect(stored.messages.at(-1).toolCalls).toHaveLength(1);
  });

  it('rejects empty and oversized messages', async () => {
    const { body } = await start();
    expect((await send(body.token, '   ')).status).toBe(400);
    expect((await send(body.token, 'x'.repeat(1001))).status).toBe(400);
  });
});

describe('session separation', () => {
  it('does not accept a staff token in the buyer chat', async () => {
    const staff = await createStaff();
    const res = await request(app)
      .post('/api/chat/messages')
      .set(authHeader(staff))
      .send({ text: 'hi' });
    expect(res.status).toBe(401);
  });

  it('does not accept a buyer token on staff routes', async () => {
    const { body } = await start();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(401);
  });
});

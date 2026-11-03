import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { Conversation, Project, Slot, Visit } from '../../src/models/index.js';
import { useTestDatabase } from '../helpers/db.js';
import { HOUR, createProject, createSlot } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();

let project;
let token;

beforeEach(async () => {
  project = await createProject({ code: 'P2', name: 'Project 2' });
  const res = await request(app)
    .post('/api/chat/sessions')
    .send({ name: 'Nidhi Shah', phone: '97270 12345', projectCode: 'P2', consent: true });
  token = res.body.token;
});

const asBuyer = (req) => req.set('Authorization', `Bearer ${token}`);

describe('GET /api/projects/catalog', () => {
  it('lists active projects with their registered details, without signing in', async () => {
    await createProject({ code: 'P9', name: 'Old project' });
    await Project.updateOne({ code: 'P9' }, { $set: { isActive: false } });

    const res = await request(app).get('/api/projects/catalog');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      code: 'P2',
      name: 'Project 2',
      reraNumber: 'PR/GJ/AHMEDABAD/AUDA/P2',
      location: { address: 'SG Highway', city: 'Ahmedabad' },
      configurations: [expect.objectContaining({ bhk: 2 }), expect.objectContaining({ bhk: 3 })],
    });
  });
});

describe('chat session payload', () => {
  it('tells the chat who the buyer is and which project to show slots for', async () => {
    const res = await asBuyer(request(app).get('/api/chat/messages'));

    expect(res.body.buyer).toEqual({
      name: 'Nidhi Shah',
      language: 'en',
      projectCode: 'P2',
      optedOut: false,
    });
  });

  it('asks the chat to open the slot picker when the assistant looked up slots', async () => {
    await createSlot(project);

    const res = await asBuyer(request(app).post('/api/chat/messages')).send({
      text: 'Can I book a site visit?',
    });

    expect(res.body).toMatchObject({ mode: 'ai', offerSlots: true, visitBooked: false });
  });
});

describe('/api/chat/visit', () => {
  it('books the picked slot and notes it in the chat', async () => {
    const slot = await createSlot(project);

    const res = await asBuyer(request(app).post('/api/chat/visit')).send({ slotId: slot.id });

    expect(res.status).toBe(201);
    expect(res.body.visit).toMatchObject({
      status: 'booked',
      startsAt: slot.startsAt.toISOString(),
      project: { code: 'P2', name: 'Project 2', reraNumber: 'PR/GJ/AHMEDABAD/AUDA/P2' },
    });
    expect((await Slot.findById(slot._id)).bookedCount).toBe(1);

    const chat = await asBuyer(request(app).get('/api/chat/messages'));
    expect(chat.body.messages.at(-1).text).toMatch(/is booked for/);

    const current = await asBuyer(request(app).get('/api/chat/visit'));
    expect(current.body.visit.id).toBe(res.body.visit.id);
  });

  it('moves an existing visit instead of refusing a second one', async () => {
    const first = await createSlot(project);
    const second = await createSlot(project, { startsAt: new Date(Date.now() + 72 * HOUR) });
    await asBuyer(request(app).post('/api/chat/visit')).send({ slotId: first.id });

    const res = await asBuyer(request(app).post('/api/chat/visit')).send({ slotId: second.id });

    expect(res.status).toBe(201);
    expect(await Visit.countDocuments({ status: 'booked' })).toBe(1);
    expect((await Slot.findById(first._id)).bookedCount).toBe(0);
    expect((await Slot.findById(second._id)).bookedCount).toBe(1);
  });

  it('returns 409 with the reason when the slot filled up meanwhile', async () => {
    const slot = await createSlot(project, { capacity: 1, bookedCount: 1 });

    const res = await asBuyer(request(app).post('/api/chat/visit')).send({ slotId: slot.id });

    expect(res.status).toBe(409);
    expect(res.body.details).toMatchObject({ reason: 'slot_full' });
  });

  it('cancels the upcoming visit', async () => {
    const slot = await createSlot(project);
    await asBuyer(request(app).post('/api/chat/visit')).send({ slotId: slot.id });

    const res = await asBuyer(request(app).delete('/api/chat/visit'));

    expect(res.status).toBe(200);
    expect(res.body.visit.status).toBe('cancelled');
    expect((await asBuyer(request(app).get('/api/chat/visit'))).body.visit).toBeNull();
    expect((await asBuyer(request(app).delete('/api/chat/visit'))).status).toBe(404);
    const conversation = await Conversation.findOne();
    expect(conversation.messages.at(-1).text).toMatch(/is cancelled/);
  });

  it('needs a buyer session and a valid slot id', async () => {
    expect((await request(app).get('/api/chat/visit')).status).toBe(401);
    const res = await asBuyer(request(app).post('/api/chat/visit')).send({ slotId: 'nope' });
    expect(res.status).toBe(400);
  });
});

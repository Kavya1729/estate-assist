import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { getFreeSlots } from '../../src/ai/tools/getFreeSlots.js';
import { createApp } from '../../src/app.js';
import { ROLES } from '../../src/constants/domain.js';
import { Lead, Outbox, Slot, Visit } from '../../src/models/index.js';
import { signBuyerToken } from '../../src/services/authService.js';
import { bookVisit, cancelVisit } from '../../src/services/visitService.js';
import { authHeader } from '../helpers/auth.js';
import { useTestDatabase } from '../helpers/db.js';
import {
  HOUR,
  LAKH,
  createLead,
  createProject,
  createSlot,
  createStaff,
} from '../helpers/factories.js';

useTestDatabase();

const app = createApp();

let project;
let executive;
let head;

beforeEach(async () => {
  project = await createProject();
  executive = await createStaff({ projects: [project._id] });
  head = await createStaff({
    name: 'Meera Desai',
    email: 'meera@estate.test',
    role: ROLES.SALES_HEAD,
  });
});

function book(user, body) {
  return request(app).post('/api/visits').set(authHeader(user)).send(body);
}

describe('POST /api/visits', () => {
  it('books a free slot, updates the lead and queues a confirmation', async () => {
    const lead = await createLead(project, {
      assignedTo: executive._id,
      profile: { bhk: 3, budgetMax: 110 * LAKH },
    });
    const slot = await createSlot(project);

    const res = await book(executive, { leadId: lead.id, slotId: slot.id });

    expect(res.status).toBe(201);
    expect(res.body.visit).toMatchObject({ status: 'booked', bookedVia: 'staff', slot: slot.id });

    expect((await Slot.findById(slot.id)).bookedCount).toBe(1);
    const updated = await Lead.findById(lead.id);
    expect(updated.status).toBe('visit_booked');
    expect(updated.score).toBe(70);
    expect(updated.temperature).toBe('hot');

    const [message] = await Outbox.find();
    expect(message).toMatchObject({
      template: 'visit_confirmation',
      to: `+91${lead.normalizedPhone}`,
      status: 'queued',
    });
    expect(message.body).toContain('Project 1');
  });

  it('refuses a full slot with a clear message', async () => {
    const slot = await createSlot(project, { capacity: 1, bookedCount: 1 });
    const lead = await createLead(project, { assignedTo: executive._id });

    const res = await book(executive, { leadId: lead.id, slotId: slot.id });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/just taken/) });
    expect(await Visit.countDocuments()).toBe(0);
  });

  it('refuses slots that are blocked, too soon or for another project', async () => {
    const lead = await createLead(project, { assignedTo: executive._id });
    const other = await createProject({ code: 'P2', name: 'Project 2' });

    const blocked = await createSlot(project, { isBlocked: true });
    const tooSoon = await createSlot(project, { startsAt: new Date(Date.now() + 20 * 60 * 1000) });
    const elsewhere = await createSlot(other);

    expect((await book(head, { leadId: lead.id, slotId: blocked.id })).status).toBe(409);
    expect((await book(head, { leadId: lead.id, slotId: tooSoon.id })).status).toBe(400);
    expect((await book(head, { leadId: lead.id, slotId: elsewhere.id })).status).toBe(400);
    expect(await Slot.countDocuments({ bookedCount: { $gt: 0 } })).toBe(0);
  });

  it('allows only one upcoming visit per buyer', async () => {
    const lead = await createLead(project, { assignedTo: executive._id });
    const [a, b] = [
      await createSlot(project),
      await createSlot(project, { startsAt: new Date(Date.now() + 72 * HOUR) }),
    ];

    await book(executive, { leadId: lead.id, slotId: a.id });
    const res = await book(executive, { leadId: lead.id, slotId: b.id });

    expect(res.status).toBe(409);
    expect((await Slot.findById(b.id)).bookedCount).toBe(0);
  });

  it('lets executives book only their own leads; the sales head can book any', async () => {
    const colleague = await createStaff({ name: 'Amit Rana', email: 'amit@estate.test' });
    const lead = await createLead(project, { assignedTo: colleague._id });
    const slot = await createSlot(project);

    expect((await book(executive, { leadId: lead.id, slotId: slot.id })).status).toBe(403);
    expect((await book(head, { leadId: lead.id, slotId: slot.id })).status).toBe(201);
  });

  it('requires a session and valid ids', async () => {
    const anonymous = await request(app).post('/api/visits').send({});
    expect(anonymous.status).toBe(401);

    const invalid = await book(head, { leadId: 'abc', slotId: '' });
    expect(invalid.status).toBe(400);
  });

  it('takes no buyer bookings for a project closed for enquiries; staff can still book', async () => {
    await project.updateOne({ isActive: false });
    const buyer = await createLead(project);
    const lead = await createLead(project, { assignedTo: executive._id });
    const slot = await createSlot(project);

    const offered = await getFreeSlots.run({}, { leadId: buyer._id });
    expect(offered).toMatchObject({ ok: false, error: expect.stringMatching(/paused/) });

    // Without an actor, as the chat's slot picker and the assistant book.
    await expect(
      bookVisit({ leadId: buyer._id, slotId: slot._id, bookedVia: 'assistant' }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/paused/) });

    expect((await book(executive, { leadId: lead.id, slotId: slot.id })).status).toBe(201);
    expect((await Slot.findById(slot.id)).bookedCount).toBe(1);
  });

  it('suppresses the confirmation for a buyer who opted out', async () => {
    const lead = await createLead(project, { optedOut: true, optedOutAt: new Date() });
    const slot = await createSlot(project);

    await book(head, { leadId: lead.id, slotId: slot.id });

    expect((await Outbox.findOne()).status).toBe('skipped_opt_out');
  });
});

describe('no double booking under concurrency', () => {
  it('lets exactly two of twenty simultaneous buyers into a two-seat slot', async () => {
    const slot = await createSlot(project, { capacity: 2 });
    const leads = await Promise.all(Array.from({ length: 20 }, () => createLead(project)));

    const results = await Promise.allSettled(
      leads.map((lead) =>
        bookVisit({ leadId: lead._id, slotId: slot._id, bookedVia: 'assistant' }),
      ),
    );

    const booked = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');
    expect(booked).toHaveLength(2);
    expect(refused.every((r) => r.reason.status === 409)).toBe(true);

    expect((await Slot.findById(slot._id)).bookedCount).toBe(2);
    expect(await Visit.countDocuments({ slot: slot._id, status: 'booked' })).toBe(2);
    expect(await Lead.countDocuments({ status: 'visit_booked' })).toBe(2);
    expect(await Outbox.countDocuments({ template: 'visit_confirmation' })).toBe(2);
  });

  it('holds over HTTP when twenty buyers pick the same two-seat slot in the chat', async () => {
    const slot = await createSlot(project, { capacity: 2 });
    const leads = await Promise.all(Array.from({ length: 20 }, () => createLead(project)));

    const responses = await Promise.all(
      leads.map((lead) =>
        request(app)
          .post('/api/chat/visit')
          .set('Authorization', `Bearer ${signBuyerToken(lead)}`)
          .send({ slotId: slot.id }),
      ),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(2);
    expect(statuses.filter((s) => s === 409)).toHaveLength(18);
    expect(responses.find((r) => r.status === 409).body.error).toMatch(/just taken/);
    expect((await Slot.findById(slot.id)).bookedCount).toBe(2);
    expect(await Visit.countDocuments({ status: 'booked' })).toBe(2);
  });

  it('keeps the seat count exact when cancellations and bookings race', async () => {
    const slot = await createSlot(project, { capacity: 1 });
    const first = await createLead(project);
    const visit = await bookVisit({ leadId: first._id, slotId: slot._id, bookedVia: 'assistant' });
    const others = await Promise.all(Array.from({ length: 6 }, () => createLead(project)));

    await Promise.allSettled([
      cancelVisit({ visitId: visit._id }),
      ...others.map((lead) =>
        bookVisit({ leadId: lead._id, slotId: slot._id, bookedVia: 'assistant' }),
      ),
    ]);

    const booked = await Visit.countDocuments({ slot: slot._id, status: 'booked' });
    expect(booked).toBeLessThanOrEqual(1);
    expect((await Slot.findById(slot._id)).bookedCount).toBe(booked);
  });

  it('gives one buyer clicking several slots at once only one visit', async () => {
    const lead = await createLead(project);
    const slots = await Promise.all(
      [48, 49, 50, 51, 52].map((h) =>
        createSlot(project, { startsAt: new Date(Date.now() + h * HOUR) }),
      ),
    );

    const results = await Promise.allSettled(
      slots.map((slot) =>
        bookVisit({ leadId: lead._id, slotId: slot._id, bookedVia: 'assistant' }),
      ),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await Visit.countDocuments({ lead: lead._id, status: 'booked' })).toBe(1);
    const seats = await Slot.find().select('bookedCount');
    expect(seats.reduce((sum, s) => sum + s.bookedCount, 0)).toBe(1);
  });
});

describe('visit lifecycle', () => {
  async function bookedVisit(slotOverrides = {}) {
    const lead = await createLead(project, { assignedTo: executive._id });
    const slot = await createSlot(project, slotOverrides);
    const visit = await bookVisit({ leadId: lead._id, slotId: slot._id, bookedVia: 'assistant' });
    return { lead, slot, visit };
  }

  it('cancelling frees the seat and returns the lead to engaged', async () => {
    const { lead, slot, visit } = await bookedVisit();

    const res = await request(app)
      .post(`/api/visits/${visit.id}/cancel`)
      .set(authHeader(executive));

    expect(res.status).toBe(200);
    expect(res.body.visit.status).toBe('cancelled');
    expect((await Slot.findById(slot._id)).bookedCount).toBe(0);
    expect((await Lead.findById(lead._id)).status).toBe('engaged');

    const again = await request(app)
      .post(`/api/visits/${visit.id}/cancel`)
      .set(authHeader(executive));
    expect(again.status).toBe(409);
  });

  it('rescheduling moves the seat and confirms the new time', async () => {
    const { slot, visit } = await bookedVisit();
    const later = await createSlot(project, { startsAt: new Date(Date.now() + 72 * HOUR) });

    const res = await request(app)
      .post(`/api/visits/${visit.id}/reschedule`)
      .set(authHeader(executive))
      .send({ slotId: later.id });

    expect(res.status).toBe(201);
    expect(res.body.visit.slot).toBe(later.id);
    expect((await Slot.findById(slot._id)).bookedCount).toBe(0);
    expect((await Slot.findById(later._id)).bookedCount).toBe(1);
    expect(await Visit.countDocuments({ status: 'booked' })).toBe(1);
    expect(await Outbox.countDocuments({ template: 'visit_confirmation' })).toBe(2);
  });

  it('refuses to reschedule into the same slot', async () => {
    const { slot, visit } = await bookedVisit();

    const res = await request(app)
      .post(`/api/visits/${visit.id}/reschedule`)
      .set(authHeader(executive))
      .send({ slotId: slot.id });

    expect(res.status).toBe(400);
    expect((await Slot.findById(slot._id)).bookedCount).toBe(1);
  });

  it('refuses to cancel a visit that has already started', async () => {
    const { visit } = await bookedVisit();
    await Visit.updateOne({ _id: visit._id }, { $set: { startsAt: new Date(Date.now() - HOUR) } });

    const res = await request(app)
      .post(`/api/visits/${visit.id}/cancel`)
      .set(authHeader(executive));

    expect(res.status).toBe(400);
    expect((await Visit.findById(visit._id)).status).toBe('booked');
  });

  it('keeps the original booking when the new slot is full', async () => {
    const { slot, visit } = await bookedVisit();
    const full = await createSlot(project, {
      startsAt: new Date(Date.now() + 72 * HOUR),
      capacity: 1,
      bookedCount: 1,
    });

    const res = await request(app)
      .post(`/api/visits/${visit.id}/reschedule`)
      .set(authHeader(executive))
      .send({ slotId: full.id });

    expect(res.status).toBe(409);
    expect((await Visit.findById(visit._id)).status).toBe('booked');
    expect((await Slot.findById(slot._id)).bookedCount).toBe(1);
  });

  it('records the outcome only once the visit has started', async () => {
    const { lead, visit } = await bookedVisit();
    const early = await request(app)
      .post(`/api/visits/${visit.id}/outcome`)
      .set(authHeader(executive))
      .send({ outcome: 'visited' });
    expect(early.status).toBe(400);

    await Visit.updateOne({ _id: visit._id }, { $set: { startsAt: new Date(Date.now() - HOUR) } });
    const res = await request(app)
      .post(`/api/visits/${visit.id}/outcome`)
      .set(authHeader(executive))
      .send({ outcome: 'visited' });

    expect(res.status).toBe(200);
    expect(res.body.visit.status).toBe('visited');
    const updated = await Lead.findById(lead._id);
    expect(updated.status).toBe('visited');
    expect(updated.scoreReasons).toContain('Visited the site');
  });
});

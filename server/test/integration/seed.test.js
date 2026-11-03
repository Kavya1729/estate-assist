import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { istDateOf } from '../../src/lib/time.js';
import { Conversation, Lead, Outbox, Project, Slot, User, Visit } from '../../src/models/index.js';
import { DEMO_PASSWORD, seedDatabase } from '../../src/seed/seedDatabase.js';
import { useTestDatabase } from '../helpers/db.js';

useTestDatabase();

const app = createApp();
const NOW = new Date('2026-11-04T10:00:00+05:30');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return { Authorization: `Bearer ${res.body.token}` };
}

describe('seedDatabase', () => {
  it('loads the projects, team, sample rows and about 60 leads', async () => {
    const summary = await seedDatabase({ now: NOW });

    expect(summary).toMatchObject({ projects: 2, staff: 5, leads: 60 });
    const projects = await Project.find().sort({ code: 1 });
    expect(projects.map((p) => p.name)).toEqual(['Project 1', 'Project 2']);
    expect(projects.every((p) => p.reraNumber && p.facts.length >= 8)).toBe(true);
    expect(await User.countDocuments({ role: 'sales_executive' })).toBe(4);
    expect(await User.countDocuments({ role: 'sales_head' })).toBe(1);

    const [hardik, nidhi, kavita] = await Promise.all(
      ['LD-58210', 'LD-58211', 'LD-58224'].map((code) =>
        Lead.findOne({ code }).populate('project', 'code'),
      ),
    );
    expect(hardik).toMatchObject({
      name: 'Hardik Patel',
      primarySource: 'portal',
      status: 'visit_booked',
    });
    expect(hardik.project.code).toBe('P1');
    expect(hardik.profile.bhk).toBe(3);
    const hardikVisit = await Visit.findOne({ lead: hardik._id, status: 'booked' });
    expect(hardikVisit.startsAt).toEqual(new Date('2026-11-01T11:00:00+05:30'));

    expect(nidhi).toMatchObject({
      name: 'Nidhi Shah',
      primarySource: 'social_ad',
      status: 'engaged',
    });
    expect(nidhi.project.code).toBe('P2');
    expect(await Visit.countDocuments({ lead: nidhi._id })).toBe(0);

    expect(kavita).toMatchObject({
      name: 'Kavita Joshi',
      primarySource: 'hoarding_call',
      status: 'visited',
    });
    expect(kavita.profile.bhk).toBe(2);
  });

  it('never overbooks a slot and keeps visits consistent with leads', async () => {
    await seedDatabase({ now: NOW });

    const slots = await Slot.find().lean();
    const days = new Set(slots.map((s) => istDateOf(s.startsAt)));
    expect(days.size).toBeGreaterThanOrEqual(21);
    expect(slots.some((s) => s.isBlocked)).toBe(true);

    const visits = await Visit.find().lean();
    const seats = new Map();
    for (const visit of visits.filter((v) => v.status !== 'cancelled')) {
      seats.set(String(visit.slot), (seats.get(String(visit.slot)) ?? 0) + 1);
    }
    for (const slot of slots) {
      expect(slot.bookedCount).toBe(seats.get(String(slot._id)) ?? 0);
      expect(slot.bookedCount).toBeLessThanOrEqual(slot.capacity);
    }

    expect(new Set(visits.map((v) => v.status))).toEqual(
      new Set(['booked', 'visited', 'no_show', 'cancelled']),
    );
    for (const visit of visits.filter((v) => v.status === 'visited' || v.status === 'no_show')) {
      expect(visit.endsAt <= NOW).toBe(true);
    }
    const leads = await Lead.find({ _id: { $in: visits.map((v) => v.lead) } }).lean();
    const statusOf = new Map(leads.map((l) => [String(l._id), l.status]));
    for (const visit of visits.filter((v) => v.status === 'booked')) {
      expect(statusOf.get(String(visit.lead))).toBe('visit_booked');
    }

    const outbox = await Outbox.find().lean();
    expect(outbox.every((m) => m.to.startsWith('+91') && m.status === 'sent')).toBe(true);
    expect(new Set(outbox.map((m) => m.template)).size).toBe(4);
  });

  it('fills every staff screen: lead list, duplicates, handoffs, review queue and dashboard', async () => {
    await seedDatabase({ now: NOW });
    const head = await loginAs('meera.desai@example.com');

    const list = await request(app).get('/api/leads?limit=50').set(head);
    expect(list.body.total).toBe(60);
    const duplicates = await request(app).get('/api/leads?duplicates=open').set(head);
    expect(duplicates.body.total).toBeGreaterThanOrEqual(3);
    const handoffs = await request(app).get('/api/leads?handoff=pending').set(head);
    expect(handoffs.body.items.map((l) => l.name)).toEqual(
      expect.arrayContaining(['Rajesh Thakkar', 'Bhavesh Prajapati']),
    );

    const reviews = await request(app).get('/api/reviews').set(head);
    expect(reviews.body.items.map((r) => r.lead.name)).toContain('Nidhi Shah');

    const detail = await request(app)
      .get(`/api/leads/${(await Lead.findOne({ code: 'LD-58210' })).id}`)
      .set(head);
    const toolNames = detail.body.conversations[0].messages.flatMap((m) =>
      (m.toolCalls ?? []).map((c) => c.name),
    );
    expect(toolNames).toEqual(
      expect.arrayContaining(['get_facts', 'get_free_slots', 'book_visit']),
    );

    const dashboard = await request(app)
      .get(`/api/dashboard?from=2026-10-06&to=2026-11-04`)
      .set(head);
    for (const row of dashboard.body.bySource) {
      expect(row.leads).toBeGreaterThan(0);
      expect(row.spend).toBeGreaterThan(0);
    }
    expect(dashboard.body.totals.visited).toBeGreaterThan(0);
    expect(dashboard.body.totals.medianFirstResponseSeconds).toBeLessThan(120);

    expect(await Conversation.countDocuments({ 'messages.role': 'staff' })).toBeGreaterThan(0);
    const executive = await loginAs('ravi.mehta@example.com');
    const own = await request(app).get('/api/leads').set(executive);
    expect(own.body.total).toBeGreaterThan(0);
    expect(own.body.total).toBeLessThan(60);
  });

  it('gives the same data on every run and continues lead codes after the seed', async () => {
    await seedDatabase({ now: NOW });
    const first = await Lead.find().sort({ code: 1 }).select('code name phone').lean();

    await seedDatabase({ now: NOW });
    const second = await Lead.find().sort({ code: 1 }).select('code name phone').lean();
    expect(second.map(({ code, name, phone }) => ({ code, name, phone }))).toEqual(
      first.map(({ code, name, phone }) => ({ code, name, phone })),
    );

    const head = await loginAs('meera.desai@example.com');
    const res = await request(app)
      .post('/api/leads/ingest/website')
      .set(head)
      .send({ name: 'Test Buyer', phone: '9000000001', projectCode: 'P1' });
    expect(res.status).toBe(201);
    expect(first.map((l) => l.code)).not.toContain(res.body.lead.code);
  });
});

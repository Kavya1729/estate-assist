import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { addDays, istDateOf } from '../../src/lib/time.js';
import { Slot } from '../../src/models/index.js';
import { generateSlots } from '../../src/services/slotService.js';
import { useTestDatabase } from '../helpers/db.js';
import { HOUR, createProject, createSlot } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();
const tomorrow = () => addDays(istDateOf(new Date()), 1);

describe('generateSlots', () => {
  it('creates the daily slots in IST with the project visit length', async () => {
    const project = await createProject();

    const created = await generateSlots(project, { from: tomorrow(), days: 2, times: ['11:00'] });

    expect(created).toBe(2);
    const [first] = await Slot.find().sort({ startsAt: 1 });
    expect(first.startsAt.toISOString()).toBe(`${tomorrow()}T05:30:00.000Z`);
    expect(first.endsAt - first.startsAt).toBe(45 * 60 * 1000);
  });

  it('is safe to run twice and keeps existing bookings', async () => {
    const project = await createProject();
    await generateSlots(project, { from: tomorrow(), days: 1, times: ['11:00'] });
    await Slot.updateOne({}, { $set: { bookedCount: 1 } });

    const created = await generateSlots(project, { from: tomorrow(), days: 1, times: ['11:00'] });

    expect(created).toBe(0);
    expect(await Slot.countDocuments()).toBe(1);
    expect((await Slot.findOne()).bookedCount).toBe(1);
  });
});

describe('GET /api/projects/:code/slots', () => {
  it('lists only slots that can really be booked', async () => {
    const project = await createProject();
    const soon = Date.now() + 48 * HOUR;
    const free = await createSlot(project, { startsAt: new Date(soon) });
    await createSlot(project, { startsAt: new Date(soon + HOUR), bookedCount: 2 });
    await createSlot(project, { startsAt: new Date(soon + 2 * HOUR), isBlocked: true });
    await createSlot(project, { startsAt: new Date(Date.now() + 30 * 60 * 1000) });
    const partly = await createSlot(project, {
      startsAt: new Date(soon + 3 * HOUR),
      bookedCount: 1,
    });

    const res = await request(app).get('/api/projects/p1/slots');

    expect(res.status).toBe(200);
    expect(res.body.timeZone).toBe('Asia/Kolkata');
    expect(res.body.project).toMatchObject({ code: 'P1', name: 'Project 1' });
    expect(res.body.slots.map((s) => [s.id, s.remaining])).toEqual([
      [free.id, 2],
      [partly.id, 1],
    ]);
  });

  it('only returns slots for the requested project and window', async () => {
    const p1 = await createProject();
    const p2 = await createProject({ code: 'P2', name: 'Project 2' });
    await generateSlots(p1, { from: tomorrow(), days: 3, times: ['11:00'] });
    await generateSlots(p2, { from: tomorrow(), days: 3, times: ['11:00'] });

    const res = await request(app).get(`/api/projects/P1/slots?from=${tomorrow()}&days=2`);

    expect(res.body.slots).toHaveLength(2);
    const ids = res.body.slots.map((s) => s.id);
    const owners = await Slot.find({ _id: { $in: ids } }).distinct('project');
    expect(owners.map(String)).toEqual([p1.id]);
  });

  it('returns 404 for an unknown project', async () => {
    const res = await request(app).get('/api/projects/P9/slots');
    expect(res.status).toBe(404);
  });

  it('rejects a malformed date or too long a window', async () => {
    await createProject();
    const res = await request(app).get('/api/projects/P1/slots?from=04-11-2026&days=90');

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['query.days', 'query.from']);
  });
});

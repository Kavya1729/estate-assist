import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { getFacts } from '../../src/ai/tools/getFacts.js';
import { createApp } from '../../src/app.js';
import { ROLES } from '../../src/constants/domain.js';
import { addDays, istDateOf } from '../../src/lib/time.js';
import { Project, Slot } from '../../src/models/index.js';
import { bookVisit } from '../../src/services/visitService.js';
import { authHeader } from '../helpers/auth.js';
import { useTestDatabase } from '../helpers/db.js';
import { createLead, createProject, createSlot, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();

let project;
let ravi;
let head;

beforeEach(async () => {
  project = await createProject();
  ravi = await createStaff({ projects: [project._id] });
  head = await createStaff({
    name: 'Meera Desai',
    email: 'meera@estate.test',
    role: ROLES.SALES_HEAD,
  });
});

const send = (method, user, url, body) =>
  request(app)[method](url).set(authHeader(user)).send(body);

describe('fact sheet', () => {
  const facts = [
    { key: 'clubhouse', label: 'Clubhouse', value: 'Clubhouse with gym and pool' },
    { key: 'parking', label: 'Parking', value: 'One covered car park per flat' },
  ];

  it('lets the sales head replace the facts the assistant answers from', async () => {
    const res = await send('patch', head, '/api/projects/P1', { facts });

    expect(res.status).toBe(200);
    expect(res.body.project.facts).toEqual(facts);
    expect((await Project.findOne({ code: 'P1' })).facts).toHaveLength(2);
  });

  it('validates facts and configurations', async () => {
    const duplicateKeys = await send('patch', head, '/api/projects/P1', {
      facts: [facts[0], { ...facts[1], key: 'clubhouse' }],
    });
    expect(duplicateKeys.status).toBe(400);

    const badRange = await send('patch', head, '/api/projects/P1', {
      configurations: [
        { bhk: 2, carpetAreaSqft: { min: 700, max: 650 }, priceRange: { min: 1, max: 2 } },
      ],
    });
    expect(badRange.status).toBe(400);
  });

  it('reaches the assistant on its next lookup, with no restart or cache', async () => {
    const lead = await createLead(project);
    await send('patch', head, '/api/projects/P1', { facts, tagline: 'Homes off SG Highway' });

    const { projects } = await getFacts.run({}, { leadId: lead._id });

    expect(projects[0]).toMatchObject({ tagline: 'Homes off SG Highway', facts });
  });

  it('takes a closed project off the website and out of the assistant', async () => {
    const lead = await createLead(project);
    await send('patch', head, '/api/projects/P1', { isActive: false });

    expect((await request(app).get('/api/projects/catalog')).body.items).toHaveLength(0);
    expect((await request(app).get('/api/projects/P1/slots')).status).toBe(404);
    expect(await getFacts.run({}, { leadId: lead._id })).toMatchObject({ ok: false });
  });

  it('is read-only for executives', async () => {
    expect((await send('patch', ravi, '/api/projects/P1', { facts })).status).toBe(403);
    expect((await send('get', ravi, '/api/projects')).body.items).toHaveLength(1);
  });
});

describe('slot admin', () => {
  const tomorrow = () => addDays(istDateOf(new Date()), 1);

  it('generates slots for the coming days', async () => {
    const res = await send('post', head, '/api/projects/P1/slots', {
      from: tomorrow(),
      days: 3,
      times: ['11:00', '16:00'],
      capacity: 3,
    });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(6);
    expect(await Slot.countDocuments({ capacity: 3 })).toBe(6);
  });

  it('shows the full schedule with who is booked, including full and blocked slots', async () => {
    const lead = await createLead(project, { name: 'Hardik Patel' });
    const booked = await createSlot(project, { capacity: 1 });
    await bookVisit({ leadId: lead._id, slotId: booked._id, bookedVia: 'staff' });
    await createSlot(project, {
      startsAt: new Date(booked.startsAt.getTime() + 3_600_000),
      isBlocked: true,
    });

    const res = await send(
      'get',
      ravi,
      `/api/projects/P1/schedule?from=${istDateOf(new Date())}&days=7`,
    );

    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      bookedCount: 1,
      remaining: 0,
      visits: [
        expect.objectContaining({
          status: 'booked',
          lead: expect.objectContaining({ name: 'Hardik Patel' }),
        }),
      ],
    });
    expect(res.body.items[1].isBlocked).toBe(true);
  });

  it('blocks a slot so it is no longer offered', async () => {
    const slot = await createSlot(project);

    await send('patch', head, `/api/slots/${slot.id}`, { isBlocked: true });

    const free = await request(app).get('/api/projects/P1/slots');
    expect(free.body.slots).toEqual([]);
  });

  it('never lowers capacity below the seats already booked', async () => {
    const slot = await createSlot(project, { capacity: 3, bookedCount: 2 });

    const tooLow = await send('patch', head, `/api/slots/${slot.id}`, { capacity: 1 });
    expect(tooLow.status).toBe(409);
    expect(tooLow.body.error).toMatch(/2 visits are already booked/);

    const ok = await send('patch', head, `/api/slots/${slot.id}`, { capacity: 2 });
    expect(ok.body.slot).toMatchObject({ capacity: 2, remaining: 0 });
  });

  it('is only for the sales head', async () => {
    const slot = await createSlot(project);
    expect((await send('patch', ravi, `/api/slots/${slot.id}`, { isBlocked: true })).status).toBe(
      403,
    );
    expect((await send('post', ravi, '/api/projects/P1/slots', {})).status).toBe(403);
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { Lead } from '../../src/models/index.js';
import { useTestDatabase } from '../helpers/db.js';
import { DEFAULT_PASSWORD, LAKH, createProject, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();
const INGEST_KEY = process.env.INGEST_API_KEY;

function ingest(source, body, key = INGEST_KEY) {
  const req = request(app).post(`/api/leads/ingest/${source}`).send(body);
  return key ? req.set('X-Ingest-Key', key) : req;
}

describe('POST /api/leads/ingest/:source access', () => {
  it('rejects requests without a key or session', async () => {
    const res = await ingest('portal', { phone: '9825012345' }, null);
    expect(res.status).toBe(401);
  });

  it('rejects a wrong ingest key', async () => {
    const res = await ingest('portal', { phone: '9825012345' }, 'wrong-key-wrong-key-wrong-key');
    expect(res.status).toBe(401);
  });

  it('accepts a signed-in sales executive entering a lead by hand', async () => {
    await createStaff();
    const { body } = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ravi@estate.test', password: DEFAULT_PASSWORD });

    const res = await request(app)
      .post('/api/leads/ingest/hoarding_call')
      .set('Authorization', `Bearer ${body.token}`)
      .send({ name: 'Kavita Joshi', phone: '9898012345' });

    expect(res.status).toBe(201);
  });
});

describe('validation', () => {
  it.each([
    ['unknown source', 'tv', { phone: '9825012345' }, 'params.source'],
    ['no phone or email', 'portal', { name: 'Hardik' }, 'body.phone'],
    ['invalid phone', 'portal', { phone: '12345' }, 'body.phone'],
    ['invalid email', 'portal', { email: 'not-an-email' }, 'body.email'],
    [
      'budget max below min',
      'portal',
      { phone: '9825012345', budgetMin: 90, budgetMax: 10 },
      'body.budgetMax',
    ],
  ])('rejects %s', async (_label, source, body, field) => {
    const res = await ingest(source, body);

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toContain(field);
  });

  it('treats empty strings from a source as missing values', async () => {
    const res = await ingest('portal', { name: 'Hardik Patel', phone: '9825012345', email: '' });

    expect(res.status).toBe(201);
  });

  it('rejects an unknown project code', async () => {
    const res = await ingest('portal', { phone: '9825012345', projectCode: 'P9' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown project/);
  });
});

describe('creating and merging leads', () => {
  it('creates a lead with the first source as its primary source', async () => {
    await createProject();

    const res = await ingest('portal', {
      name: 'Hardik Patel',
      phone: '+91 98250 12345',
      projectCode: 'p1',
      bhk: 3,
      campaign: 'diwali-3bhk',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ outcome: 'created', matchedBy: null });
    expect(res.body.lead.code).toMatch(/^LD-\d+$/);
    expect(res.body.lead).not.toHaveProperty('phone');

    const lead = await Lead.findById(res.body.lead.id);
    expect(lead.primarySource).toBe('portal');
    expect(lead.normalizedPhone).toBe('9825012345');
    expect(lead.sources[0]).toMatchObject({ source: 'portal', campaign: 'diwali-3bhk' });
  });

  it('merges the same phone in another format and records the new source', async () => {
    const first = await ingest('portal', { name: 'Hardik Patel', phone: '9825012345' });

    const second = await ingest('social_ad', {
      phone: '098250 12345',
      email: 'hardik@example.com',
    });

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ outcome: 'merged', matchedBy: 'phone' });
    expect(second.body.lead.id).toBe(first.body.lead.id);

    const lead = await Lead.findById(first.body.lead.id);
    expect(await Lead.countDocuments()).toBe(1);
    expect(lead.primarySource).toBe('portal');
    expect(lead.sources.map((s) => s.source)).toEqual(['portal', 'social_ad']);
    expect(lead.email).toBe('hardik@example.com');
  });

  it('fills in missing details on merge but never overwrites known ones', async () => {
    await ingest('portal', { name: 'Hardik Patel', phone: '9825012345', bhk: 3 });

    await ingest('website', {
      name: 'H. Patel',
      phone: '9825012345',
      bhk: 2,
      budgetMax: 110 * LAKH,
    });

    const lead = await Lead.findOne({ normalizedPhone: '9825012345' });
    expect(lead.name).toBe('Hardik Patel');
    expect(lead.profile.bhk).toBe(3);
    expect(lead.profile.budgetMax).toBe(110 * LAKH);
  });

  it('merges by email when the stored lead has no phone', async () => {
    const first = await ingest('website', { name: 'Nidhi Shah', email: 'nidhi@example.com' });

    const second = await ingest('social_ad', { phone: '9727012345', email: 'NIDHI@example.com' });

    expect(second.body).toMatchObject({ outcome: 'merged', matchedBy: 'email' });
    const lead = await Lead.findById(first.body.lead.id);
    expect(lead.normalizedPhone).toBe('9727012345');
  });

  it('keeps a shared email with a different phone as a separate, flagged lead', async () => {
    const first = await ingest('portal', {
      name: 'Nidhi Shah',
      phone: '9727012345',
      email: 'shah.family@example.com',
    });

    const second = await ingest('social_ad', {
      name: 'Ketan Shah',
      phone: '9727099999',
      email: 'shah.family@example.com',
    });

    expect(second.body.outcome).toBe('created');
    const lead = await Lead.findById(second.body.lead.id);
    expect(lead.possibleDuplicates).toEqual([
      expect.objectContaining({ reason: 'same_email', resolution: 'open' }),
    ]);
    expect(String(lead.possibleDuplicates[0].lead)).toBe(first.body.lead.id);
  });

  it('flags a similar name with a different phone as a possible duplicate', async () => {
    const first = await ingest('portal', { name: 'Kavita Joshi', phone: '9898012345' });

    const second = await ingest('hoarding_call', { name: 'kavitha  joshi', phone: '9898054321' });

    expect(second.body.outcome).toBe('created');
    expect(second.body.lead.possibleDuplicates).toBe(1);
    const lead = await Lead.findById(second.body.lead.id);
    expect(lead.possibleDuplicates[0]).toMatchObject({ reason: 'similar_name' });
    expect(String(lead.possibleDuplicates[0].lead)).toBe(first.body.lead.id);
  });

  it('does not flag different people who share a first name', async () => {
    await ingest('portal', { name: 'Hardik Patel', phone: '9825012345' });

    const res = await ingest('portal', { name: 'Hardik Shah', phone: '9825099999' });

    expect(res.body.lead.possibleDuplicates).toBe(0);
  });

  it('creates exactly one lead when the same phone arrives from two sources at once', async () => {
    const results = await Promise.all([
      ingest('portal', { name: 'Hardik Patel', phone: '9825012345' }),
      ingest('social_ad', { name: 'Hardik Patel', phone: '+919825012345' }),
      ingest('website', { phone: '09825012345' }),
    ]);

    expect(results.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(await Lead.countDocuments()).toBe(1);
    const lead = await Lead.findOne();
    expect(lead.sources).toHaveLength(3);
  });
});

describe('scoring and assignment', () => {
  it('scores the lead and explains the score', async () => {
    await createProject();

    const res = await ingest('portal', {
      phone: '9825012345',
      projectCode: 'P1',
      bhk: 3,
      budgetMax: 110 * LAKH,
      timeline: '0-3m',
      consent: true,
    });

    const lead = await Lead.findById(res.body.lead.id);
    expect(lead.score).toBe(60);
    expect(lead.temperature).toBe('warm');
    expect(lead.scoreReasons).toEqual([
      'Budget fits the project',
      'Plans to buy within 3 months',
      'Agreed to be contacted',
    ]);
    expect(lead.consent.given).toBe(true);
  });

  it('assigns to the executive with the fewest open leads on that project', async () => {
    const project = await createProject();
    const otherProject = await createProject({ code: 'P2', name: 'Project 2' });
    const busy = await createStaff({
      name: 'Busy',
      email: 'busy@estate.test',
      projects: [project.id],
    });
    const free = await createStaff({
      name: 'Free',
      email: 'free@estate.test',
      projects: [project.id],
    });
    await createStaff({ name: 'Elsewhere', email: 'p2@estate.test', projects: [otherProject.id] });
    await Lead.create([
      { primarySource: 'portal', assignedTo: busy.id, status: 'new' },
      { primarySource: 'portal', assignedTo: busy.id, status: 'engaged' },
      { primarySource: 'portal', assignedTo: free.id, status: 'lost' },
    ]);

    const res = await ingest('portal', { phone: '9825012345', projectCode: 'P1' });

    const lead = await Lead.findById(res.body.lead.id);
    expect(String(lead.assignedTo)).toBe(free.id);
    expect(lead.assignedAt).toBeInstanceOf(Date);
  });

  it('spreads a burst of leads evenly across executives', async () => {
    const project = await createProject();
    const a = await createStaff({ name: 'A', email: 'a@estate.test', projects: [project.id] });
    const b = await createStaff({ name: 'B', email: 'b@estate.test', projects: [project.id] });

    for (let i = 0; i < 6; i += 1) {
      await ingest('portal', { phone: `98250123${String(i).padStart(2, '0')}`, projectCode: 'P1' });
    }

    expect(await Lead.countDocuments({ assignedTo: a.id })).toBe(3);
    expect(await Lead.countDocuments({ assignedTo: b.id })).toBe(3);
  });

  it('falls back to any executive when nobody covers the project', async () => {
    await createProject();
    const anyone = await createStaff({ email: 'anyone@estate.test' });

    const res = await ingest('portal', { phone: '9825012345', projectCode: 'P1' });

    const lead = await Lead.findById(res.body.lead.id);
    expect(String(lead.assignedTo)).toBe(anyone.id);
  });

  it('leaves the lead unassigned when there are no active executives', async () => {
    await createStaff({ isActive: false });

    const res = await ingest('portal', { phone: '9825012345' });

    expect(res.body.lead.assigned).toBe(false);
  });

  it('does not reassign an existing lead on merge', async () => {
    const project = await createProject();
    const owner = await createStaff({
      name: 'Owner',
      email: 'owner@estate.test',
      projects: [project.id],
    });
    await ingest('portal', { phone: '9825012345', projectCode: 'P1' });
    await createStaff({ name: 'Newcomer', email: 'new@estate.test', projects: [project.id] });

    await ingest('social_ad', { phone: '9825012345', projectCode: 'P1' });

    const lead = await Lead.findOne();
    expect(String(lead.assignedTo)).toBe(owner.id);
  });
});

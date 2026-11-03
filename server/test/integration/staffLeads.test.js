import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { ROLES } from '../../src/constants/domain.js';
import { Conversation, Lead, Visit } from '../../src/models/index.js';
import { bookVisit } from '../../src/services/visitService.js';
import { authHeader } from '../helpers/auth.js';
import { useTestDatabase } from '../helpers/db.js';
import { LAKH, createLead, createProject, createSlot, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();

let project;
let ravi;
let amit;
let head;

beforeEach(async () => {
  project = await createProject();
  ravi = await createStaff({ projects: [project._id] });
  amit = await createStaff({
    name: 'Amit Rana',
    email: 'amit@estate.test',
    projects: [project._id],
  });
  head = await createStaff({
    name: 'Meera Desai',
    email: 'meera@estate.test',
    role: ROLES.SALES_HEAD,
  });
});

const get = (user, url) => request(app).get(url).set(authHeader(user));
const post = (user, url, body = {}) => request(app).post(url).set(authHeader(user)).send(body);
const patch = (user, url, body) => request(app).patch(url).set(authHeader(user)).send(body);

describe('GET /api/leads', () => {
  it('shows executives only their own leads and the sales head everything', async () => {
    await createLead(project, { name: 'Hardik Patel', assignedTo: ravi._id });
    await createLead(project, { name: 'Nidhi Shah', assignedTo: amit._id });

    const mine = await get(ravi, '/api/leads');
    const all = await get(head, '/api/leads');

    expect(mine.body.items.map((l) => l.name)).toEqual(['Hardik Patel']);
    expect(all.body.total).toBe(2);
  });

  it('ignores an executive trying to look at a colleague’s leads', async () => {
    await createLead(project, { assignedTo: amit._id });
    const res = await get(ravi, `/api/leads?assignedTo=${amit.id}`);
    expect(res.body.total).toBe(0);
  });

  it('summarises each lead for the list', async () => {
    const lead = await createLead(project, {
      name: 'Hardik Patel',
      assignedTo: ravi._id,
      profile: { bhk: 3, budgetMax: 110 * LAKH },
    });
    const slot = await createSlot(project);
    await bookVisit({ leadId: lead._id, slotId: slot._id, bookedVia: 'assistant' });

    const [item] = (await get(ravi, '/api/leads')).body.items;

    expect(item).toMatchObject({
      code: lead.code,
      name: 'Hardik Patel',
      primarySource: 'portal',
      project: { code: 'P1', name: 'Project 1' },
      profile: { bhk: 3, budgetMax: 110 * LAKH },
      status: 'visit_booked',
      temperature: 'hot',
      assignedTo: { id: ravi.id, name: 'Ravi Mehta' },
      upcomingVisit: { startsAt: slot.startsAt.toISOString() },
      handoff: null,
      openDuplicates: 0,
    });
  });

  it('filters by status, temperature, source, project and pending handoff', async () => {
    const p2 = await createProject({ code: 'P2', name: 'Project 2' });
    await createLead(project, { status: 'lost', temperature: 'cold' });
    await createLead(p2, { primarySource: 'social_ad', temperature: 'hot' });
    await createLead(project, {
      handoff: { reason: 'buyer_requested', at: new Date() },
    });

    const count = async (qs) => (await get(head, `/api/leads?${qs}`)).body.total;
    expect(await count('status=lost')).toBe(1);
    expect(await count('temperature=hot')).toBe(1);
    expect(await count('source=social_ad')).toBe(1);
    expect(await count('projectCode=p2')).toBe(1);
    expect(await count('projectCode=P9')).toBe(0);
    expect(await count('handoff=pending')).toBe(1);
  });

  it('searches by lead code, phone in any format and name', async () => {
    const hardik = await createLead(project, { name: 'Hardik Patel', phone: '9825012345' });
    await createLead(project, { name: 'Nidhi Shah', phone: '9727012345' });

    const search = async (q) =>
      (await get(head, `/api/leads?q=${encodeURIComponent(q)}`)).body.items.map((l) => l.name);
    expect(await search(hardik.code.toLowerCase())).toEqual(['Hardik Patel']);
    expect(await search('+91 98250 12345')).toEqual(['Hardik Patel']);
    expect(await search('12345')).toHaveLength(2);
    expect(await search('shah')).toEqual(['Nidhi Shah']);
    expect(await search('hard')).toEqual(['Hardik Patel']);
  });

  it('paginates and sorts by score', async () => {
    for (const score of [10, 70, 40]) await createLead(project, { score });

    const res = await get(head, '/api/leads?sort=score&limit=2');

    expect(res.body).toMatchObject({ page: 1, limit: 2, total: 3, pages: 2 });
    expect(res.body.items.map((l) => l.score)).toEqual([70, 40]);
  });

  it('rejects unknown filter values', async () => {
    const res = await get(head, '/api/leads?status=married&limit=500');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/leads/:id', () => {
  it('returns the profile, chat with tool calls, visits and outbox', async () => {
    const lead = await createLead(project, { assignedTo: ravi._id });
    const slot = await createSlot(project);
    await bookVisit({ leadId: lead._id, slotId: slot._id, bookedVia: 'assistant' });
    await Conversation.create({
      lead: lead._id,
      messages: [
        { role: 'buyer', text: 'Price?' },
        { role: 'assistant', text: 'From ₹65 lakh', toolCalls: [{ name: 'get_facts', ok: true }] },
      ],
    });

    const res = await get(ravi, `/api/leads/${lead.id}`);

    expect(res.status).toBe(200);
    expect(res.body.lead).toMatchObject({ id: lead.id, assignedTo: { name: 'Ravi Mehta' } });
    expect(res.body.visits).toHaveLength(1);
    expect(res.body.conversations[0].messages[1].toolCalls).toEqual([
      expect.objectContaining({ name: 'get_facts' }),
    ]);
    expect(res.body.outbox.map((m) => m.template)).toEqual(['visit_confirmation']);
  });

  it('is forbidden for a colleague and 404 for unknown ids', async () => {
    const lead = await createLead(project, { assignedTo: amit._id });
    expect((await get(ravi, `/api/leads/${lead.id}`)).status).toBe(403);
    expect((await get(head, '/api/leads/64b000000000000000000000')).status).toBe(404);
  });
});

describe('PATCH /api/leads/:id', () => {
  it('updates the profile and rescores', async () => {
    const lead = await createLead(project, { assignedTo: ravi._id });

    const res = await patch(ravi, `/api/leads/${lead.id}`, {
      bhk: 2,
      budgetMax: 80 * LAKH,
      timeline: '0-3m',
    });

    expect(res.status).toBe(200);
    expect(res.body.lead).toMatchObject({ score: 50, temperature: 'warm' });
  });

  it('can mark a lead lost but not set visit statuses by hand', async () => {
    const lead = await createLead(project, { assignedTo: ravi._id });
    expect((await patch(ravi, `/api/leads/${lead.id}`, { status: 'lost' })).status).toBe(200);
    expect((await patch(ravi, `/api/leads/${lead.id}`, { status: 'visited' })).status).toBe(400);
  });

  it('will not change the status of a lead with a visit booked', async () => {
    const lead = await createLead(project, { assignedTo: ravi._id });
    await bookVisit({
      leadId: lead._id,
      slotId: (await createSlot(project))._id,
      bookedVia: 'staff',
    });

    const res = await patch(ravi, `/api/leads/${lead.id}`, { status: 'lost' });

    expect(res.status).toBe(409);
    expect((await Lead.findById(lead._id)).status).toBe('visit_booked');
    expect((await patch(ravi, `/api/leads/${lead.id}`, { bhk: 3 })).status).toBe(200);
  });

  it('rejects an empty patch and unknown fields', async () => {
    const lead = await createLead(project, { assignedTo: ravi._id });
    expect((await patch(ravi, `/api/leads/${lead.id}`, {})).status).toBe(400);
    expect((await patch(ravi, `/api/leads/${lead.id}`, { score: 100 })).status).toBe(400);
  });
});

describe('POST /api/leads/:id/assign', () => {
  it('lets the sales head move a lead and its upcoming visit', async () => {
    const lead = await createLead(project, { assignedTo: ravi._id });
    const slot = await createSlot(project);
    await bookVisit({ leadId: lead._id, slotId: slot._id, bookedVia: 'assistant' });

    const res = await post(head, `/api/leads/${lead.id}/assign`, { executiveId: amit.id });

    expect(res.status).toBe(200);
    expect(String((await Lead.findById(lead._id)).assignedTo)).toBe(amit.id);
    expect(String((await Visit.findOne()).assignedTo)).toBe(amit.id);
  });

  it('is only for the sales head and only to active executives', async () => {
    const lead = await createLead(project, { assignedTo: ravi._id });
    expect(
      (await post(ravi, `/api/leads/${lead.id}/assign`, { executiveId: amit.id })).status,
    ).toBe(403);
    expect(
      (await post(head, `/api/leads/${lead.id}/assign`, { executiveId: head.id })).status,
    ).toBe(400);
  });
});

describe('POST /api/leads/:id/duplicates/:otherId', () => {
  async function flaggedPair() {
    const original = await createLead(project, {
      name: 'Kavita Joshi',
      primarySource: 'hoarding_call',
      firstInboundAt: new Date(Date.now() - 86_400_000),
      sources: [{ source: 'hoarding_call', receivedAt: new Date(Date.now() - 86_400_000) }],
      assignedTo: ravi._id,
    });
    const duplicate = await createLead(project, {
      name: 'Kavitha Joshi',
      email: 'kavita@example.com',
      primarySource: 'social_ad',
      sources: [{ source: 'social_ad', receivedAt: new Date() }],
      profile: { bhk: 2 },
      assignedTo: ravi._id,
      possibleDuplicates: [{ lead: original._id, reason: 'similar_name' }],
    });
    return { original, duplicate };
  }

  it('dismisses a flag', async () => {
    const { original, duplicate } = await flaggedPair();

    const res = await post(ravi, `/api/leads/${duplicate.id}/duplicates/${original.id}`, {
      resolution: 'ignored',
    });

    expect(res.status).toBe(200);
    expect((await Lead.findById(duplicate._id)).possibleDuplicates[0].resolution).toBe('ignored');
    expect(await Lead.countDocuments({ mergedInto: { $exists: true } })).toBe(0);
  });

  it('merges the other lead in, keeping first-touch attribution and the visit', async () => {
    const { original, duplicate } = await flaggedPair();
    const slot = await createSlot(project);
    await bookVisit({ leadId: original._id, slotId: slot._id, bookedVia: 'staff' });

    const res = await post(ravi, `/api/leads/${duplicate.id}/duplicates/${original.id}`, {
      resolution: 'merged',
    });

    expect(res.status).toBe(200);
    const kept = await Lead.findById(duplicate._id);
    expect(kept).toMatchObject({ primarySource: 'hoarding_call', status: 'visit_booked' });
    expect(kept.email).toBe('kavita@example.com');
    expect(kept.sources).toHaveLength(2);
    expect(kept.possibleDuplicates[0].resolution).toBe('merged');
    expect(String((await Visit.findOne()).lead)).toBe(duplicate.id);

    const dropped = await Lead.findById(original._id);
    expect(String(dropped.mergedInto)).toBe(duplicate.id);
    expect((await get(head, '/api/leads')).body.total).toBe(1);
  });

  it('moves the phone number across when the kept lead has none', async () => {
    const original = await createLead(project, { name: 'Nidhi Shah', assignedTo: ravi._id });
    const emailOnly = await Lead.create({
      name: 'Nidhi Shah',
      email: 'nidhi@example.com',
      primarySource: 'website',
      assignedTo: ravi._id,
      possibleDuplicates: [{ lead: original._id, reason: 'similar_name' }],
    });

    await post(ravi, `/api/leads/${emailOnly.id}/duplicates/${original.id}`, {
      resolution: 'merged',
    });

    expect((await Lead.findById(emailOnly._id)).normalizedPhone).toBe(original.normalizedPhone);
    expect((await Lead.findById(original._id)).normalizedPhone).toBeUndefined();
  });

  it('refuses to merge two leads that both have visits booked', async () => {
    const { original, duplicate } = await flaggedPair();
    await bookVisit({
      leadId: original._id,
      slotId: (await createSlot(project))._id,
      bookedVia: 'staff',
    });
    await bookVisit({
      leadId: duplicate._id,
      slotId: (await createSlot(project, { startsAt: new Date(Date.now() + 96 * 3_600_000) }))._id,
      bookedVia: 'staff',
    });

    const res = await post(ravi, `/api/leads/${duplicate.id}/duplicates/${original.id}`, {
      resolution: 'merged',
    });

    expect(res.status).toBe(409);
    expect(await Lead.countDocuments({ mergedInto: { $exists: true } })).toBe(0);
  });

  it('points other open flags at the kept lead', async () => {
    const { original, duplicate } = await flaggedPair();
    const third = await createLead(project, {
      name: 'Kavita Joshi',
      assignedTo: ravi._id,
      possibleDuplicates: [{ lead: original._id, reason: 'similar_name' }],
    });

    await post(ravi, `/api/leads/${duplicate.id}/duplicates/${original.id}`, {
      resolution: 'merged',
    });

    const [flag] = (await Lead.findById(third._id)).possibleDuplicates;
    expect(String(flag.lead)).toBe(duplicate.id);
    expect(flag.resolution).toBe('open');
  });

  it('returns 404 when there is no open flag for that pair', async () => {
    const a = await createLead(project, { assignedTo: ravi._id });
    const b = await createLead(project, { assignedTo: ravi._id });
    const res = await post(ravi, `/api/leads/${a.id}/duplicates/${b.id}`, { resolution: 'merged' });
    expect(res.status).toBe(404);
  });
});

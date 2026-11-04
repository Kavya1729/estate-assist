import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { ROLES } from '../../src/constants/domain.js';
import { Conversation } from '../../src/models/index.js';
import { signBuyerToken } from '../../src/services/authService.js';
import { bookVisit } from '../../src/services/visitService.js';
import { authHeader } from '../helpers/auth.js';
import { useTestDatabase } from '../helpers/db.js';
import { HOUR, createLead, createProject, createSlot, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();

/**
 * One fixture per test: a lead owned by `owner`, with a visit, a flagged chat
 * and a possible duplicate, so every staff route has something real to act on.
 */
let ctx;

beforeEach(async () => {
  const project = await createProject();
  const owner = await createStaff({ projects: [project._id] });
  const colleague = await createStaff({ name: 'Amit Rana', email: 'amit@estate.test' });
  const head = await createStaff({
    name: 'Meera Desai',
    email: 'meera@estate.test',
    role: ROLES.SALES_HEAD,
  });
  const other = await createLead(project, { assignedTo: owner._id });
  const lead = await createLead(project, {
    assignedTo: owner._id,
    possibleDuplicates: [{ lead: other._id, reason: 'similar_name' }],
  });
  const visit = await bookVisit({
    leadId: lead._id,
    slotId: (await createSlot(project))._id,
    bookedVia: 'assistant',
  });
  const spare = await createSlot(project, { startsAt: new Date(Date.now() + 72 * HOUR) });
  const conversation = await Conversation.create({
    lead: lead._id,
    flagged: true,
    messages: [{ role: 'buyer', text: 'Hi' }],
  });

  ctx = { project, owner, colleague, head, lead, other, visit, spare, conversation };
});

/** Lead-scoped: executives may act only on their own leads; the head on any. */
const LEAD_ROUTES = [
  ['GET', (c) => `/api/leads/${c.lead.id}`],
  ['PATCH', (c) => `/api/leads/${c.lead.id}`, () => ({ name: 'Hardik P' })],
  ['POST', (c) => `/api/leads/${c.lead.id}/takeover`],
  ['POST', (c) => `/api/leads/${c.lead.id}/messages`, () => ({ text: 'Calling you now' })],
  ['POST', (c) => `/api/leads/${c.lead.id}/handback`],
  [
    'POST',
    (c) => `/api/leads/${c.lead.id}/duplicates/${c.other.id}`,
    () => ({ resolution: 'ignored' }),
  ],
  ['POST', () => '/api/visits', (c) => ({ leadId: c.lead.id, slotId: c.spare.id })],
  ['POST', (c) => `/api/visits/${c.visit.id}/reschedule`, (c) => ({ slotId: c.spare.id })],
  ['POST', (c) => `/api/visits/${c.visit.id}/outcome`, () => ({ outcome: 'visited' })],
  ['POST', (c) => `/api/visits/${c.visit.id}/cancel`],
  ['POST', (c) => `/api/reviews/${c.conversation.id}/resolve`],
];

/** Company-wide data and settings: the sales head only. */
const HEAD_ROUTES = [
  ['GET', () => '/api/dashboard'],
  ['GET', () => '/api/staff/executives'],
  ['POST', (c) => `/api/leads/${c.lead.id}/assign`, (c) => ({ executiveId: c.colleague.id })],
  ['PATCH', () => '/api/projects/P1', () => ({ tagline: 'New tagline' })],
  ['POST', () => '/api/projects/P1/slots', () => ({ days: 1 })],
  ['PATCH', (c) => `/api/slots/${c.spare.id}`, () => ({ isBlocked: true })],
];

/** Any signed-in staff member; the result is scoped, not refused. */
const STAFF_ROUTES = [
  ['GET', () => '/api/leads'],
  ['GET', () => '/api/reviews'],
  ['GET', () => '/api/projects'],
  ['GET', () => '/api/projects/P1/schedule'],
  ['GET', () => '/api/auth/me'],
];

const ALL_ROUTES = [...LEAD_ROUTES, ...HEAD_ROUTES, ...STAFF_ROUTES];

function call([method, path, body], headers = {}) {
  const req = request(app)[method.toLowerCase()](path(ctx)).set(headers);
  return body ? req.send(body(ctx)) : req.send();
}

const name = ([method, path]) =>
  `${method} ${path({
    lead: { id: ':id' },
    other: { id: ':otherId' },
    visit: { id: ':visitId' },
    spare: { id: ':slotId' },
    conversation: { id: ':conversationId' },
  })}`;
const named = (routes) => routes.map((route) => [name(route), route]);

describe('without a staff session', () => {
  it.each(named(ALL_ROUTES))('%s refuses an anonymous request', async (_, route) => {
    expect((await call(route)).status).toBe(401);
  });

  it.each(named(ALL_ROUTES))('%s refuses a buyer chat token', async (_, route) => {
    const buyer = { Authorization: `Bearer ${signBuyerToken(ctx.lead)}` };
    expect((await call(route, buyer)).status).toBe(401);
  });
});

describe('sales executives', () => {
  it.each(named(LEAD_ROUTES))('%s is forbidden on a colleague’s lead', async (_, route) => {
    const res = await call(route, authHeader(ctx.colleague));
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/another sales executive/);
  });

  it.each(named(LEAD_ROUTES))('%s is allowed on their own lead', async (_, route) => {
    expect([401, 403]).not.toContain((await call(route, authHeader(ctx.owner))).status);
  });

  it.each(named(HEAD_ROUTES))('%s is for the sales head only', async (_, route) => {
    expect((await call(route, authHeader(ctx.owner))).status).toBe(403);
  });

  it.each(named(STAFF_ROUTES))('%s is open to them', async (_, route) => {
    expect((await call(route, authHeader(ctx.colleague))).status).toBe(200);
  });

  it('never see a colleague’s leads in the list, even by asking for them', async () => {
    const path = `/api/leads?assignedTo=${ctx.owner.id}`;
    const asOwner = await request(app).get(path).set(authHeader(ctx.owner));
    const asColleague = await request(app).get(path).set(authHeader(ctx.colleague));

    expect(asOwner.body.total).toBe(2);
    expect(asColleague.body.total).toBe(0);
  });
});

describe('the sales head', () => {
  it.each(named([...LEAD_ROUTES, ...HEAD_ROUTES]))('%s is allowed', async (_, route) => {
    expect([401, 403]).not.toContain((await call(route, authHeader(ctx.head))).status);
  });

  it('loses head access as soon as the role is changed, without a new token', async () => {
    const header = authHeader(ctx.head);
    ctx.head.role = ROLES.SALES_EXECUTIVE;
    await ctx.head.save();

    expect((await request(app).get('/api/dashboard').set(header)).status).toBe(403);
  });
});

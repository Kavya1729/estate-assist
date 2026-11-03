import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { ROLES } from '../../src/constants/domain.js';
import { istDateOf } from '../../src/lib/time.js';
import { Conversation, SourceSpend, Visit } from '../../src/models/index.js';
import { authHeader } from '../helpers/auth.js';
import { useTestDatabase } from '../helpers/db.js';
import { createLead, createProject, createSlot, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();
const SECOND = 1000;

let project;
let head;

beforeEach(async () => {
  project = await createProject();
  head = await createStaff({
    name: 'Meera Desai',
    email: 'meera@estate.test',
    role: ROLES.SALES_HEAD,
  });
});

async function leadFrom(source, { respondedAfterSeconds, visit, temperature } = {}) {
  const firstInboundAt = new Date(Date.now() - 3_600_000);
  const lead = await createLead(project, {
    primarySource: source,
    firstInboundAt,
    temperature,
    ...(respondedAfterSeconds != null && {
      firstResponseAt: new Date(firstInboundAt.getTime() + respondedAfterSeconds * SECOND),
    }),
  });
  if (visit) {
    const slot = await createSlot(project, {
      startsAt: new Date(Date.now() + Math.random() * 1e9 + 1e8),
    });
    await Visit.create({
      lead: lead._id,
      slot: slot._id,
      project: project._id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: visit,
      bookedVia: 'assistant',
    });
  }
  return lead;
}

const dashboard = (qs = '') => request(app).get(`/api/dashboard${qs}`).set(authHeader(head));

describe('GET /api/dashboard', () => {
  it('reports response time, visits, show-up rate and cost per visit by source', async () => {
    await leadFrom('portal', { respondedAfterSeconds: 30, visit: 'visited', temperature: 'hot' });
    await leadFrom('portal', { respondedAfterSeconds: 90, visit: 'no_show' });
    await leadFrom('portal', { respondedAfterSeconds: 300, visit: 'cancelled' });
    await leadFrom('portal');
    await leadFrom('social_ad', { respondedAfterSeconds: 10, visit: 'booked' });
    await SourceSpend.create({
      source: 'portal',
      month: istDateOf(new Date()).slice(0, 7),
      amount: 40_000,
    });

    const res = await dashboard();

    expect(res.status).toBe(200);
    const portal = res.body.bySource.find((s) => s.source === 'portal');
    expect(portal).toEqual({
      source: 'portal',
      leads: 4,
      hotLeads: 1,
      responded: 3,
      medianFirstResponseSeconds: 90,
      respondedWithinTarget: 0.5,
      visitsBooked: 2,
      visited: 1,
      noShows: 1,
      showUpRate: 0.5,
      spend: 40_000,
      costPerLead: 10_000,
      costPerVisit: 40_000,
    });

    const social = res.body.bySource.find((s) => s.source === 'social_ad');
    expect(social).toMatchObject({
      leads: 1,
      visitsBooked: 1,
      showUpRate: null,
      costPerVisit: null,
    });
    expect(res.body.totals).toMatchObject({ leads: 5, visitsBooked: 3, spend: 40_000 });
    expect(res.body.bySource.map((s) => s.source)).toEqual([
      'portal',
      'social_ad',
      'website',
      'hoarding_call',
    ]);
  });

  it('counts leads only inside the date range', async () => {
    await leadFrom('website');
    const res = await dashboard('?from=2020-01-01&to=2020-01-31');
    expect(res.body.totals.leads).toBe(0);
    expect(res.body.range).toMatchObject({
      from: '2020-01-01',
      to: '2020-01-31',
      spendMonths: ['2020-01'],
    });
  });

  it('shows the queues waiting for the team', async () => {
    const lead = await createLead(project, { handoff: { reason: 'hot_lead', at: new Date() } });
    await Conversation.create({ lead: lead._id, flagged: true });

    const res = await dashboard();

    expect(res.body.queues).toEqual({ pendingHandoffs: 1, pendingReviews: 1, openDuplicates: 0 });
  });

  it('is only for the sales head and validates the range', async () => {
    const ravi = await createStaff();
    expect((await request(app).get('/api/dashboard').set(authHeader(ravi))).status).toBe(403);
    expect((await dashboard('?from=2026-02-01&to=2026-01-01')).status).toBe(400);
  });
});

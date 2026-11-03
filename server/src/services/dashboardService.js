import { LEAD_SOURCES } from '../constants/domain.js';
import { groupBy } from '../lib/collections.js';
import { addDays, istDateOf, istDayStart } from '../lib/time.js';
import { Conversation, Lead, SourceSpend, Visit } from '../models/index.js';

/** The brief's promise: every enquiry answered within two minutes. */
export const RESPONSE_TARGET_SECONDS = 120;
const DEFAULT_RANGE_DAYS = 30;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const ratio = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 1000 : null);
const money = (amount, per) => (per ? Math.round(amount / per) : null);

/** Calendar months (YYYY-MM) touched by the range. Spend is recorded per whole month. */
function monthsBetween(from, to) {
  const months = [];
  for (let month = from.slice(0, 7); month <= to.slice(0, 7);) {
    months.push(month);
    const [y, m] = month.split('-').map(Number);
    month = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return months;
}

function summarise(leads, visitsByLead, spend) {
  const responseSeconds = leads
    .filter((l) => l.firstResponseAt)
    .map((l) => Math.max((l.firstResponseAt - l.firstInboundAt) / 1000, 0));

  let visitsBooked = 0;
  let visited = 0;
  let noShows = 0;
  for (const lead of leads) {
    const visits = visitsByLead.get(String(lead._id)) ?? [];
    if (visits.length) visitsBooked += 1;
    visited += visits.filter((v) => v.status === 'visited').length;
    noShows += visits.filter((v) => v.status === 'no_show').length;
  }

  return {
    leads: leads.length,
    hotLeads: leads.filter((l) => l.temperature === 'hot').length,
    responded: responseSeconds.length,
    medianFirstResponseSeconds: median(responseSeconds),
    respondedWithinTarget: ratio(
      responseSeconds.filter((s) => s <= RESPONSE_TARGET_SECONDS).length,
      leads.length,
    ),
    visitsBooked,
    visited,
    noShows,
    showUpRate: ratio(visited, visited + noShows),
    spend,
    costPerLead: money(spend, leads.length),
    costPerVisit: money(spend, visited),
  };
}

/**
 * The source dashboard. Leads are attributed to their first source and counted
 * by when they arrived; their visits count whenever they happen. Cost per visit
 * uses completed visits (people who actually came to the site).
 */
export async function getSourceDashboard({ from, to } = {}) {
  const toDate = to ?? istDateOf(new Date());
  const fromDate = from ?? addDays(toDate, -(DEFAULT_RANGE_DAYS - 1));

  const leads = await Lead.find({
    mergedInto: { $exists: false },
    createdAt: { $gte: istDayStart(fromDate), $lt: istDayStart(addDays(toDate, 1)) },
  })
    .select('primarySource firstInboundAt firstResponseAt temperature')
    .lean();

  const [visits, spendRows, pendingHandoffs, pendingReviews, openDuplicates] = await Promise.all([
    Visit.find({ lead: { $in: leads.map((l) => l._id) }, status: { $ne: 'cancelled' } })
      .select('lead status')
      .lean(),
    SourceSpend.find({ month: { $in: monthsBetween(fromDate, toDate) } }).lean(),
    Lead.countDocuments({
      mergedInto: { $exists: false },
      'handoff.at': { $exists: true },
      'handoff.acknowledgedAt': { $exists: false },
    }),
    Conversation.countDocuments({ flagged: true, reviewedAt: { $exists: false } }),
    Lead.countDocuments({
      mergedInto: { $exists: false },
      'possibleDuplicates.resolution': 'open',
    }),
  ]);

  const visitsByLead = groupBy(visits, (v) => String(v.lead));
  const spendBySource = new Map();
  for (const row of spendRows) {
    spendBySource.set(row.source, (spendBySource.get(row.source) ?? 0) + row.amount);
  }

  const bySource = LEAD_SOURCES.map((source) => ({
    source,
    ...summarise(
      leads.filter((l) => l.primarySource === source),
      visitsByLead,
      spendBySource.get(source) ?? 0,
    ),
  }));
  const totalSpend = [...spendBySource.values()].reduce((sum, amount) => sum + amount, 0);

  return {
    range: { from: fromDate, to: toDate, spendMonths: monthsBetween(fromDate, toDate) },
    responseTargetSeconds: RESPONSE_TARGET_SECONDS,
    totals: summarise(leads, visitsByLead, totalSpend),
    bySource,
    queues: { pendingHandoffs, pendingReviews, openDuplicates },
  };
}

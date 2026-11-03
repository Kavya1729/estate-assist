import mongoose from 'mongoose';

import { HttpError } from '../lib/httpError.js';
import { escapeRegex, normalizeName } from '../lib/names.js';
import { normalizeIndianMobile } from '../lib/phone.js';
import { Conversation, Lead, Outbox, Project, Visit } from '../models/index.js';
import { canManageLead, leadScope } from './leadAccess.js';

const SORTS = {
  recent: { updatedAt: -1, _id: -1 },
  score: { score: -1, updatedAt: -1 },
  created: { createdAt: -1, _id: -1 },
};

const idOf = (doc) => (doc ? String(doc._id) : null);
const person = (user) => (user ? { id: idOf(user), name: user.name } : null);
const projectRef = (project) => (project ? { code: project.code, name: project.name } : null);

function searchFilter(q) {
  const text = q.trim();
  if (/^LD-\d+$/i.test(text)) return { code: text.toUpperCase() };

  const digits = text.replace(/\D/g, '');
  if (digits.length >= 4 && digits.length === text.replace(/[\s+()-]/g, '').length) {
    const phone = normalizeIndianMobile(digits);
    return phone
      ? { normalizedPhone: phone }
      : { normalizedPhone: { $regex: escapeRegex(digits) } };
  }

  const key = normalizeName(text);
  return key ? { nameKey: { $regex: `(^| )${escapeRegex(key)}` } } : {};
}

async function buildFilter(user, query) {
  const filter = { ...leadScope(user), mergedInto: { $exists: false } };

  if (query.status) filter.status = query.status;
  if (query.temperature) filter.temperature = query.temperature;
  if (query.source) filter.primarySource = query.source;
  if (query.assignedTo && !filter.assignedTo) {
    filter.assignedTo = query.assignedTo === 'unassigned' ? { $exists: false } : query.assignedTo;
  }
  if (query.projectCode) {
    const project = await Project.findOne({ code: query.projectCode }).select('_id').lean();
    // An unknown code must match nothing (null would match leads without a project).
    filter.project = project?._id ?? new mongoose.Types.ObjectId();
  }
  if (query.handoff === 'pending') {
    filter['handoff.at'] = { $exists: true };
    filter['handoff.acknowledgedAt'] = { $exists: false };
  }
  if (query.duplicates === 'open') filter['possibleDuplicates.resolution'] = 'open';
  if (query.q) Object.assign(filter, searchFilter(query.q));

  return filter;
}

function listItem(lead, { visit, conversation }) {
  return {
    id: idOf(lead),
    code: lead.code,
    name: lead.name ?? null,
    phone: lead.phone ?? null,
    primarySource: lead.primarySource,
    sourceCount: lead.sources?.length ?? 0,
    project: projectRef(lead.project),
    profile: {
      bhk: lead.profile?.bhk ?? null,
      budgetMin: lead.profile?.budgetMin ?? null,
      budgetMax: lead.profile?.budgetMax ?? null,
      timeline: lead.profile?.timeline ?? 'unknown',
    },
    score: lead.score,
    temperature: lead.temperature,
    status: lead.status,
    assignedTo: person(lead.assignedTo),
    handoff: lead.handoff?.at
      ? { reason: lead.handoff.reason, at: lead.handoff.at, pending: !lead.handoff.acknowledgedAt }
      : null,
    openDuplicates: (lead.possibleDuplicates ?? []).filter((d) => d.resolution === 'open').length,
    upcomingVisit: visit ? { id: idOf(visit), startsAt: visit.startsAt } : null,
    conversation: conversation
      ? {
          mode: conversation.mode,
          flagged: conversation.flagged && !conversation.reviewedAt,
          lastMessageAt: conversation.lastMessageAt,
        }
      : null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

/** One page of the lead list, scoped to what the user may see. */
export async function listLeads(user, { page = 1, limit = 20, sort = 'recent', ...query } = {}) {
  const filter = await buildFilter(user, query);

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .sort(SORTS[sort] ?? SORTS.recent)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('assignedTo', 'name')
      .populate('project', 'code name')
      .lean(),
    Lead.countDocuments(filter),
  ]);

  const ids = leads.map((l) => l._id);
  const [visits, conversations] = await Promise.all([
    Visit.find({ lead: { $in: ids }, status: 'booked' })
      .select('lead startsAt')
      .lean(),
    Conversation.find({ lead: { $in: ids } })
      .select('lead mode flagged reviewedAt lastMessageAt')
      .sort({ lastMessageAt: 1 })
      .lean(),
  ]);
  const visitBy = new Map(visits.map((v) => [String(v.lead), v]));
  const conversationBy = new Map(conversations.map((c) => [String(c.lead), c]));

  return {
    items: leads.map((lead) =>
      listItem(lead, {
        visit: visitBy.get(String(lead._id)),
        conversation: conversationBy.get(String(lead._id)),
      }),
    ),
    page,
    limit,
    total,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

/** Everything the lead detail screen shows: profile, chat with tool calls, visits, messages sent. */
export async function getLeadDetail(user, leadId) {
  const lead = await Lead.findById(leadId)
    .populate('assignedTo', 'name email')
    .populate('project', 'code name')
    .populate('possibleDuplicates.lead', 'code name phone primarySource createdAt mergedInto');
  if (!lead || lead.mergedInto) throw new HttpError(404, 'Lead not found.');
  if (!canManageLead(user, { assignedTo: lead.assignedTo?._id })) {
    throw new HttpError(403, 'This lead is assigned to another sales executive.');
  }

  const [visits, conversations, outbox] = await Promise.all([
    Visit.find({ lead: lead._id }).sort({ startsAt: -1 }).populate('project', 'code name'),
    Conversation.find({ lead: lead._id })
      .sort({ lastMessageAt: -1 })
      .populate('takenOverBy', 'name')
      .populate('messages.author', 'name'),
    Outbox.find({ lead: lead._id }).sort({ createdAt: -1 }).limit(50),
  ]);

  return {
    lead: lead.toJSON(),
    visits: visits.map((v) => v.toJSON()),
    conversations: conversations.map((c) => c.toJSON()),
    outbox: outbox.map((m) => m.toJSON()),
  };
}

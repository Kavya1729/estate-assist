import mongoose from 'mongoose';

import { ROLES } from '../constants/domain.js';
import { HttpError } from '../lib/httpError.js';
import { Conversation, Lead, Project, User, Visit } from '../models/index.js';
import { assertCanManageLead, findManageableLead } from './leadAccess.js';
import { applyLeadScore } from './leadScoring.js';

const MAX_SOURCE_TOUCHES = 50;
const PROFILE_FIELDS = ['bhk', 'budgetMin', 'budgetMax', 'timeline', 'notes'];

async function rescore(lead, session) {
  const project = lead.project
    ? await Project.findById(lead.project)
        .session(session ?? null)
        .lean()
    : null;
  applyLeadScore(lead, project);
}

/** Staff corrections to a lead. Visit-related statuses only change through visits. */
export async function updateLead(user, leadId, patch) {
  const lead = await findManageableLead(user, leadId);

  if (patch.status && patch.status !== lead.status && lead.status === 'visit_booked') {
    throw new HttpError(409, 'This lead has a visit booked. Cancel the visit first.');
  }
  if (patch.projectCode) {
    const project = await Project.findOne({ code: patch.projectCode, isActive: true }).lean();
    if (!project) throw new HttpError(400, `Unknown project: ${patch.projectCode}`);
    lead.project = project._id;
  }
  for (const field of ['name', 'status', 'language']) {
    if (patch[field] !== undefined) lead[field] = patch[field];
  }
  for (const field of PROFILE_FIELDS) {
    if (patch[field] !== undefined) lead.profile[field] = patch[field] ?? undefined;
  }

  await rescore(lead);
  await lead.save();
  return lead;
}

/** Sales head moves a lead (and its upcoming visit) to another executive. */
export async function assignLead(leadId, executiveId) {
  const [lead, executive] = await Promise.all([
    Lead.findById(leadId),
    User.findOne({ _id: executiveId, role: ROLES.SALES_EXECUTIVE, isActive: true }).lean(),
  ]);
  if (!lead || lead.mergedInto) throw new HttpError(404, 'Lead not found.');
  if (!executive) throw new HttpError(400, 'Choose an active sales executive.');

  lead.assignedTo = executive._id;
  lead.assignedAt = new Date();
  await lead.save();
  await Visit.updateMany(
    { lead: lead._id, status: 'booked' },
    { $set: { assignedTo: executive._id } },
  );
  return lead;
}

function fillBlanks(keep, drop) {
  if (!keep.name && drop.name) keep.name = drop.name;
  if (!keep.email && drop.email) keep.email = drop.email;
  if (!keep.project && drop.project) keep.project = drop.project;
  if (!keep.assignedTo && drop.assignedTo) {
    keep.assignedTo = drop.assignedTo;
    keep.assignedAt = new Date();
  }
  for (const field of PROFILE_FIELDS) {
    if (keep.profile[field] == null && drop.profile?.[field] != null) {
      keep.profile[field] = drop.profile[field];
    }
  }
  if (keep.profile.timeline === 'unknown' && drop.profile?.timeline) {
    keep.profile.timeline = drop.profile.timeline;
  }
  const { budgetMin, budgetMax } = keep.profile;
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax)
    keep.profile.budgetMin = undefined;
  if (!keep.consent?.given && drop.consent?.given) keep.consent = drop.consent;

  // First touch keeps the attribution, whichever record it is on.
  if (drop.firstInboundAt < keep.firstInboundAt) {
    keep.firstInboundAt = drop.firstInboundAt;
    keep.primarySource = drop.primarySource;
  }
  keep.sources = [...keep.sources, ...drop.sources]
    .sort((a, b) => a.receivedAt - b.receivedAt)
    .slice(-MAX_SOURCE_TOUCHES);
}

/**
 * Merges `drop` into `keep` in one transaction: blanks are filled, sources and
 * the upcoming visit move across, and `drop` leaves the lead list (it is kept,
 * marked `mergedInto`, so nothing is lost).
 */
async function mergeLeads(keepId, dropId) {
  // Operations on one session must run one at a time; MongoDB rejects parallel ones.
  return mongoose.connection.transaction(async (session) => {
    const keep = await Lead.findById(keepId).session(session);
    const drop = await Lead.findById(dropId).session(session);
    if (!drop || drop.mergedInto) throw new HttpError(404, 'The duplicate lead no longer exists.');

    const keepVisit = await Visit.findOne({ lead: keep._id, status: 'booked' }).session(session);
    const dropVisit = await Visit.findOne({ lead: drop._id, status: 'booked' }).session(session);
    if (keepVisit && dropVisit) {
      throw new HttpError(409, 'Both leads have a visit booked. Cancel one before merging.');
    }

    if (!keep.normalizedPhone && drop.normalizedPhone) {
      const phone = drop.phone;
      drop.phone = undefined;
      await drop.save({ session });
      keep.phone = phone;
    }
    fillBlanks(keep, drop);

    if (dropVisit) {
      dropVisit.lead = keep._id;
      await dropVisit.save({ session });
      keep.status = 'visit_booked';
    }

    const keepChannels = await Conversation.find({ lead: keep._id })
      .session(session)
      .distinct('channel');
    await Conversation.updateMany(
      { lead: drop._id, channel: { $nin: keepChannels } },
      { $set: { lead: keep._id } },
      { session },
    );

    keep.possibleDuplicates.forEach((flag) => {
      if (String(flag.lead) === String(drop._id)) flag.resolution = 'merged';
    });
    await rescore(keep, session);
    await keep.save({ session });

    drop.mergedInto = keep._id;
    drop.status = 'lost';
    await drop.save({ session });

    // Other leads flagged against the merged-away record now point at the kept one.
    await Lead.updateMany(
      { _id: { $ne: keep._id }, 'possibleDuplicates.lead': drop._id },
      { $set: { 'possibleDuplicates.$[flag].lead': keep._id } },
      { arrayFilters: [{ 'flag.lead': drop._id, 'flag.resolution': 'open' }], session },
    );
    return keep;
  });
}

/** Resolves a possible-duplicate flag on a lead: merge the other lead into it, or dismiss the flag. */
export async function resolveDuplicate(user, leadId, otherId, resolution) {
  const lead = await findManageableLead(user, leadId);
  const flag = lead.possibleDuplicates.find(
    (f) => String(f.lead) === String(otherId) && f.resolution === 'open',
  );
  if (!flag) throw new HttpError(404, 'There is no open duplicate flag for that lead.');

  if (resolution === 'ignored') {
    flag.resolution = 'ignored';
    await lead.save();
    return lead;
  }

  const other = await Lead.findById(otherId).lean();
  if (other) assertCanManageLead(user, other);
  return mergeLeads(lead._id, otherId);
}

import { HttpError } from '../lib/httpError.js';
import { escapeRegex, nameSimilarity } from '../lib/names.js';
import { normalizeIndianMobile } from '../lib/phone.js';
import { Lead, Project } from '../models/index.js';
import { pickExecutive } from './assignmentService.js';
import { applyLeadScore } from './leadScoring.js';

export const SIMILAR_NAME_THRESHOLD = 0.85;
const MAX_SOURCE_TOUCHES = 50;
const MAX_DUPLICATE_FLAGS = 5;
const NAME_PREFIX_LENGTH = 3;
const MAX_NAME_CANDIDATES = 200;
const PROFILE_FIELDS = ['bhk', 'budgetMin', 'budgetMax', 'notes'];

async function resolveProject(projectCode) {
  if (!projectCode) return null;
  const project = await Project.findOne({ code: projectCode, isActive: true });
  if (!project) throw new HttpError(400, `Unknown project: ${projectCode}`);
  return project;
}

/**
 * Same phone is always the same buyer. Same email is the same buyer only when
 * the phones do not conflict; otherwise (e.g. a shared family email) it is left
 * as a separate lead and flagged for a person to decide.
 */
async function findExistingLead({ normalizedPhone, email }) {
  if (normalizedPhone) {
    const lead = await Lead.findOne({ normalizedPhone });
    if (lead) return { lead, matchedBy: 'phone' };
  }
  if (email) {
    const filter = normalizedPhone ? { email, normalizedPhone: null } : { email };
    const lead = await Lead.findOne(filter).sort({ createdAt: 1 });
    if (lead) return { lead, matchedBy: 'email' };
  }
  return null;
}

function applyInput(lead, input, project) {
  if (!lead.name && input.name) lead.name = input.name;
  if (!lead.phone && input.phone) lead.phone = input.phone;
  if (!lead.email && input.email) lead.email = input.email;
  if (!lead.project && project) lead.project = project._id;

  for (const field of PROFILE_FIELDS) {
    if (lead.profile[field] == null && input[field] != null) lead.profile[field] = input[field];
  }
  const { budgetMin, budgetMax } = lead.profile;
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
    // Blank-filling from two different sources produced an inverted range; keep the known side.
    if (input.budgetMin === budgetMin) lead.profile.budgetMin = undefined;
    else lead.profile.budgetMax = undefined;
  }
  if (input.timeline && lead.profile.timeline === 'unknown') lead.profile.timeline = input.timeline;

  if (input.consent && !lead.consent.given) lead.consent = { given: true, at: new Date() };
}

function addSourceTouch(lead, source, input) {
  lead.sources.push({
    source,
    receivedAt: new Date(),
    campaign: input.campaign,
    externalRef: input.externalRef,
  });
  if (lead.sources.length > MAX_SOURCE_TOUCHES) {
    lead.sources.splice(0, lead.sources.length - MAX_SOURCE_TOUCHES);
  }
}

async function findPossibleDuplicates(lead) {
  const flags = [];

  if (lead.nameKey) {
    // A short prefix still uses the index but tolerates typos later in the first name.
    const prefix = lead.nameKey.slice(0, NAME_PREFIX_LENGTH);
    const candidates = await Lead.find({
      _id: { $ne: lead._id },
      nameKey: { $regex: `^${escapeRegex(prefix)}` },
    })
      .select('nameKey normalizedPhone')
      .sort({ createdAt: -1 })
      .limit(MAX_NAME_CANDIDATES)
      .lean();

    for (const candidate of candidates) {
      const differentPhone = candidate.normalizedPhone !== lead.normalizedPhone;
      if (
        differentPhone &&
        nameSimilarity(candidate.nameKey, lead.nameKey) >= SIMILAR_NAME_THRESHOLD
      ) {
        flags.push({ lead: candidate._id, reason: 'similar_name' });
      }
    }
  }

  if (lead.email) {
    const sameEmail = await Lead.find({ _id: { $ne: lead._id }, email: lead.email })
      .select('_id')
      .limit(MAX_DUPLICATE_FLAGS)
      .lean();
    for (const other of sameEmail) flags.push({ lead: other._id, reason: 'same_email' });
  }

  const seen = new Set();
  return flags
    .filter((flag) => !seen.has(String(flag.lead)) && seen.add(String(flag.lead)))
    .slice(0, MAX_DUPLICATE_FLAGS);
}

async function refreshScoreAndOwner(lead, project) {
  const projectForScore =
    project ?? (lead.project ? await Project.findById(lead.project).lean() : null);
  applyLeadScore(lead, projectForScore);

  if (!lead.assignedTo) {
    const owner = await pickExecutive(lead.project);
    if (owner) {
      lead.assignedTo = owner;
      lead.assignedAt = new Date();
    }
  }
}

async function mergeInto(lead, source, input, project, matchedBy) {
  applyInput(lead, input, project);
  addSourceTouch(lead, source, input);
  await refreshScoreAndOwner(lead, project);
  await lead.save();
  return { outcome: 'merged', matchedBy, lead };
}

async function createLead(source, input, project) {
  const lead = new Lead({
    primarySource: source,
    language: input.language,
    profile: {},
  });
  applyInput(lead, input, project);
  addSourceTouch(lead, source, input);
  await lead.validate();

  lead.possibleDuplicates = await findPossibleDuplicates(lead);
  await refreshScoreAndOwner(lead, project);
  await lead.save();
  return { outcome: 'created', matchedBy: null, lead };
}

/**
 * Adds a lead from any source. A buyer who is already known is merged into the
 * existing lead (the new source is recorded) instead of being created twice.
 */
export async function ingestLead(source, input) {
  const project = await resolveProject(input.projectCode);
  const normalizedPhone = input.phone ? normalizeIndianMobile(input.phone) : null;

  const existing = await findExistingLead({ normalizedPhone, email: input.email });
  if (existing) return mergeInto(existing.lead, source, input, project, existing.matchedBy);

  try {
    return await createLead(source, input, project);
  } catch (err) {
    const racedOnPhone = err.code === 11000 && err.keyPattern?.normalizedPhone;
    if (!racedOnPhone) throw err;
    const lead = await Lead.findOne({ normalizedPhone });
    return mergeInto(lead, source, input, project, 'phone');
  }
}

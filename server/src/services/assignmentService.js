import { ROLES } from '../constants/domain.js';
import { Lead, User } from '../models/index.js';

/** Leads an executive is still actively working; these count towards their load. */
export const OPEN_LEAD_STATUSES = Object.freeze(['new', 'engaged', 'visit_booked']);

async function activeExecutives(filter = {}) {
  return User.find({ role: ROLES.SALES_EXECUTIVE, isActive: true, ...filter })
    .select('_id')
    .sort({ _id: 1 })
    .lean();
}

/**
 * Picks the active sales executive with the fewest open leads, preferring those
 * who cover the lead's project. Ties go to the earliest-created executive so the
 * choice is deterministic. Returns null when nobody is available.
 */
export async function pickExecutive(projectId) {
  let executives = projectId ? await activeExecutives({ projects: projectId }) : [];
  if (!executives.length) executives = await activeExecutives();
  if (!executives.length) return null;

  const ids = executives.map((e) => e._id);
  const loads = await Lead.aggregate([
    { $match: { assignedTo: { $in: ids }, status: { $in: OPEN_LEAD_STATUSES } } },
    { $group: { _id: '$assignedTo', open: { $sum: 1 } } },
  ]);
  const openById = new Map(loads.map((l) => [String(l._id), l.open]));
  const load = (id) => openById.get(String(id)) ?? 0;

  return ids.reduce((best, id) => (load(id) < load(best) ? id : best));
}

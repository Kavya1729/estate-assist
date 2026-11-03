import { ROLES } from '../constants/domain.js';
import { Lead, User } from '../models/index.js';
import { OPEN_LEAD_STATUSES } from './assignmentService.js';

/** Active executives with their open-lead load, for the assign menu. */
export async function listExecutives() {
  const executives = await User.find({ role: ROLES.SALES_EXECUTIVE, isActive: true })
    .populate('projects', 'code name')
    .sort({ name: 1 })
    .lean();

  const loads = await Lead.aggregate([
    {
      $match: {
        assignedTo: { $in: executives.map((e) => e._id) },
        status: { $in: OPEN_LEAD_STATUSES },
        mergedInto: { $exists: false },
      },
    },
    { $group: { _id: '$assignedTo', open: { $sum: 1 } } },
  ]);
  const openBy = new Map(loads.map((l) => [String(l._id), l.open]));

  return executives.map((e) => ({
    id: String(e._id),
    name: e.name,
    email: e.email,
    projects: e.projects.map((p) => ({ code: p.code, name: p.name })),
    openLeads: openBy.get(String(e._id)) ?? 0,
  }));
}

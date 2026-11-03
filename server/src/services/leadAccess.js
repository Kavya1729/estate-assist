import { ROLES } from '../constants/domain.js';
import { HttpError } from '../lib/httpError.js';
import { Lead } from '../models/index.js';

/** Sales heads manage every lead; an executive manages only the leads assigned to them. */
export function canManageLead(user, lead) {
  if (user.role === ROLES.SALES_HEAD) return true;
  return Boolean(lead.assignedTo) && String(lead.assignedTo) === String(user._id);
}

export function assertCanManageLead(user, lead) {
  if (!canManageLead(user, lead)) {
    throw new HttpError(403, 'This lead is assigned to another sales executive.');
  }
}

/** Mongo filter limiting a query to the leads the user may see. */
export function leadScope(user) {
  return user.role === ROLES.SALES_HEAD ? {} : { assignedTo: user._id };
}

/** Loads a lead the user may manage, or fails with 404 / 403. */
export async function findManageableLead(user, leadId) {
  const lead = await Lead.findById(leadId);
  if (!lead || lead.mergedInto) throw new HttpError(404, 'Lead not found.');
  assertCanManageLead(user, lead);
  return lead;
}

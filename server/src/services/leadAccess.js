import { ROLES } from '../constants/domain.js';
import { HttpError } from '../lib/httpError.js';

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

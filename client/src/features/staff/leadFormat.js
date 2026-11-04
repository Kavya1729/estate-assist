import { formatRupees } from '@/lib/format';

export function budgetLabel({ budgetMin, budgetMax } = {}) {
  if (budgetMin != null && budgetMax != null) {
    return formatRupees(budgetMin) === formatRupees(budgetMax)
      ? formatRupees(budgetMax)
      : `${formatRupees(budgetMin)} – ${formatRupees(budgetMax)}`;
  }
  if (budgetMax != null) return `Up to ${formatRupees(budgetMax)}`;
  if (budgetMin != null) return `From ${formatRupees(budgetMin)}`;
  return null;
}

/** "Project 1 · 3 BHK" with whatever is known. */
export function interestLabel(lead) {
  const parts = [lead.project?.name, lead.profile?.bhk && `${lead.profile.bhk} BHK`].filter(
    Boolean,
  );
  return parts.length ? parts.join(' · ') : 'Not shared yet';
}

export const leadName = (lead) => lead.name || 'Unnamed lead';

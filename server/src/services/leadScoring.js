/**
 * Rule-based lead score. Deliberately not AI: every point has a reason the
 * sales team can read and challenge.
 */
export const SCORE_RULES = Object.freeze({
  budgetFits: 30,
  visitBooked: 40,
  buyingSoon: 20,
  consentGiven: 10,
});

export const HOT_THRESHOLD = 70;
export const WARM_THRESHOLD = 40;

const VISIT_STATUSES = new Set(['visit_booked', 'visited']);

/**
 * True when the buyer's budget overlaps the price range of a matching
 * configuration (same BHK if known, otherwise any).
 */
export function budgetFitsProject(profile = {}, project) {
  const { budgetMin, budgetMax, bhk } = profile;
  if (budgetMax == null || !project?.configurations?.length) return false;

  const candidates = bhk
    ? project.configurations.filter((c) => c.bhk === bhk)
    : project.configurations;

  return candidates.some(
    ({ priceRange }) => budgetMax >= priceRange.min && (budgetMin ?? 0) <= priceRange.max,
  );
}

export function scoreLead(lead, project) {
  const reasons = [];
  let score = 0;

  if (budgetFitsProject(lead.profile, project)) {
    score += SCORE_RULES.budgetFits;
    reasons.push('Budget fits the project');
  }
  if (VISIT_STATUSES.has(lead.status)) {
    score += SCORE_RULES.visitBooked;
    reasons.push(lead.status === 'visited' ? 'Visited the site' : 'Site visit booked');
  }
  if (lead.profile?.timeline === '0-3m') {
    score += SCORE_RULES.buyingSoon;
    reasons.push('Plans to buy within 3 months');
  }
  if (lead.consent?.given) {
    score += SCORE_RULES.consentGiven;
    reasons.push('Agreed to be contacted');
  }

  const temperature = score >= HOT_THRESHOLD ? 'hot' : score >= WARM_THRESHOLD ? 'warm' : 'cold';
  return { score, temperature, reasons };
}

/** Recomputes the score on a lead document in place (call before saving). */
export function applyLeadScore(lead, project) {
  const { score, temperature, reasons } = scoreLead(lead, project);
  lead.score = score;
  lead.temperature = temperature;
  lead.scoreReasons = reasons;
}

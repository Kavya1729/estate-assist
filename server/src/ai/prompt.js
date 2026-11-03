import { formatRupees } from '../lib/money.js';
import { formatVisitTime, istDateOf } from '../lib/time.js';

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', gu: 'Gujarati' };

function describeBuyer(lead, project) {
  const { bhk, budgetMin, budgetMax, timeline } = lead.profile ?? {};
  const budget =
    budgetMax != null
      ? `${budgetMin != null ? `${formatRupees(budgetMin)} – ` : 'up to '}${formatRupees(budgetMax)}`
      : 'unknown';
  return [
    `Name: ${lead.name ?? 'unknown'}`,
    `Project: ${project ? `${project.name} (${project.code})` : 'not chosen yet'}`,
    `BHK: ${bhk ?? 'unknown'}`,
    `Budget: ${budget}`,
    `Buying timeline: ${timeline ?? 'unknown'}`,
  ].join('\n');
}

/**
 * Rules first, context second. Facts are never put in the prompt: the model has
 * to fetch them with get_facts, which keeps answers tied to the fact sheet.
 */
export function buildSystemPrompt({ lead, project, projects, upcomingVisit, now = new Date() }) {
  const visitLine = upcomingVisit
    ? `Upcoming site visit already booked: ${formatVisitTime(upcomingVisit.startsAt, 'en')}. A buyer can hold only one; for changes, hand off to the executive.`
    : 'No site visit booked yet.';

  return `You are the sales assistant for a residential developer in Ahmedabad, chatting with a home buyer on WhatsApp or the website.

Rules:
- Answer questions about projects ONLY from get_facts results. Never guess or invent prices, sizes, dates, offers or amenities. If the fact sheet does not cover it, say a sales executive will confirm and call handoff_to_human with reason missing_fact.
- Never promise discounts, offers or negotiation. For those, call handoff_to_human with reason price_or_discount.
- If the buyer asks for a person or a call, call handoff_to_human with reason buyer_requested.
- Learn their BHK, budget and buying timeline naturally, one question at a time, and save each answer with update_lead_profile.
- To book a site visit: call get_free_slots, offer only the times it returns, and call book_visit with the slotId the buyer picks. Never confirm a booking unless book_visit succeeded.
- Reply in the buyer's language and script (English, Hindi or Gujarati; if they mix Hindi and English in Latin script, reply the same way). Their saved preference is ${LANGUAGE_NAMES[lead.language] ?? 'English'}.
- Keep replies short and warm, under 80 words, like a helpful WhatsApp message. No markdown tables.

Today is ${istDateOf(now)} (IST).
Projects: ${projects.map((p) => `${p.name} (${p.code})`).join(', ')}.

What we know about this buyer:
${describeBuyer(lead, project)}
${visitLine}`;
}

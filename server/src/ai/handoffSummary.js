import { z } from 'zod';

import { formatRupees } from '../lib/money.js';

const SUMMARY_WINDOW = 20;

const summarySchema = z.object({
  needs: z.string().trim().min(1).max(500),
  budget: z.string().trim().max(120).nullish(),
  questions: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
  concerns: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
});

const SUMMARY_PROMPT = `You write handoff notes for a real-estate sales executive who is about to call a buyer.
Read the chat and return only a JSON object with these keys:
- "needs": one sentence on what the buyer wants (project, BHK, timing).
- "budget": the budget the buyer stated, or null if they did not state one.
- "questions": up to 5 questions the buyer asked that still need an answer.
- "concerns": up to 5 worries or objections the buyer raised.
Use only what is in the chat. Write in English even if the chat is in Hindi or Gujarati.`;

// \b only understands ASCII letters, so Devanagari and Gujarati question words are matched separately.
const QUESTION =
  /\?|^\s*(what|when|where|which|how|is|are|can|do|does|will|kya|kitna|kitne|kab|kaha|kaise)\b|(क्या|कितना|कितने|कब|कहाँ|કેટલું|કેટલા|ક્યારે|ક્યાં|શું)/iu;
const CONCERN =
  /(loan|emi|delay|possession|parking|maintenance|price|cost|expensive|budget|discount|water|legal|rera|safety|traffic|कीमत|महंगा|लोन|કિંમત|મોંઘું|લોન)/iu;

function profileBudget(profile = {}) {
  const { budgetMin, budgetMax } = profile;
  if (budgetMax == null) return null;
  return budgetMin != null
    ? `${formatRupees(budgetMin)} – ${formatRupees(budgetMax)}`
    : `up to ${formatRupees(budgetMax)}`;
}

function buyerTexts(messages, latestText) {
  const texts = messages.filter((m) => m.role === 'buyer').map((m) => m.text);
  if (latestText) texts.push(latestText);
  return texts.slice(-SUMMARY_WINDOW);
}

/** Built from the lead profile and simple patterns; used whenever the model cannot help. */
export function ruleBasedSummary({ lead, project, messages = [], latestText }) {
  const { bhk, timeline } = lead.profile ?? {};
  const texts = buyerTexts(messages, latestText);
  const clip = (text) => text.slice(0, 300);

  const needs = [
    bhk ? `${bhk} BHK` : 'A home',
    `in ${project?.name ?? 'one of our projects'}`,
    timeline && timeline !== 'unknown' ? `buying in ${timeline}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    needs,
    budget: profileBudget(lead.profile),
    questions: texts
      .filter((t) => QUESTION.test(t))
      .slice(-3)
      .map(clip),
    concerns: texts
      .filter((t) => CONCERN.test(t))
      .slice(-3)
      .map(clip),
    source: 'rules',
  };
}

function chatTranscript({ lead, project, messages, latestText }) {
  const lines = messages
    .filter((m) => m.role === 'buyer' || m.role === 'assistant' || m.role === 'staff')
    .slice(-SUMMARY_WINDOW)
    .map((m) => `${m.role === 'buyer' ? 'Buyer' : 'Assistant'}: ${m.text}`);
  if (latestText) lines.push(`Buyer: ${latestText}`);

  return [
    `Known profile: project ${project?.name ?? 'unknown'}, BHK ${lead.profile?.bhk ?? 'unknown'}, budget ${profileBudget(lead.profile) ?? 'unknown'}.`,
    '',
    ...lines,
  ].join('\n');
}

/**
 * Asks the model for a structured summary (one JSON call, validated by zod)
 * and falls back to the rule-based summary if the call fails or the JSON is
 * unusable. Pass `useModel: false` when the provider is already known to be down.
 */
export async function summarizeForHandoff({
  provider,
  lead,
  project,
  messages = [],
  latestText,
  useModel = true,
  logger = console,
}) {
  if (useModel && provider?.completeJSON) {
    try {
      const raw = await provider.completeJSON({
        messages: [
          { role: 'system', content: SUMMARY_PROMPT },
          { role: 'user', content: chatTranscript({ lead, project, messages, latestText }) },
        ],
      });
      const parsed = summarySchema.safeParse(raw);
      if (parsed.success) {
        return { ...parsed.data, budget: parsed.data.budget ?? null, source: 'model' };
      }
      logger.warn('[handoff] summary JSON did not match the schema; using rules');
    } catch (err) {
      logger.warn(`[handoff] summary call failed (${err.message}); using rules`);
    }
  }
  return ruleBasedSummary({ lead, project, messages, latestText });
}

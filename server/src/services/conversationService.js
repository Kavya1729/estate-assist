import { runAgentTurn } from '../ai/agent.js';
import { detectLanguage } from '../ai/guardrails/language.js';
import { findUnverifiedNumbers, knownNumbers } from '../ai/guardrails/postChecks.js';
import { runPreChecks } from '../ai/guardrails/preChecks.js';
import { summarizeForHandoff } from '../ai/handoffSummary.js';
import { toModelMessages } from '../ai/history.js';
import { buildSystemPrompt } from '../ai/prompt.js';
import { getLLMProvider } from '../ai/providers/index.js';
import { fixedReply, greeting, handoffReply } from '../ai/replies.js';
import { describeProject } from '../ai/tools/getFacts.js';
import { HttpError } from '../lib/httpError.js';
import {
  Conversation,
  Lead,
  MAX_MESSAGES_PER_CONVERSATION,
  Project,
  Visit,
} from '../models/index.js';
import { handOffToHuman } from './handoffService.js';

/** Appends messages atomically, keeping only the newest ones once the cap is reached. */
async function appendMessages(conversationId, messages, set = {}) {
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $push: { messages: { $each: messages, $slice: -MAX_MESSAGES_PER_CONVERSATION } },
      $set: { lastMessageAt: new Date(), ...set },
    },
  );
}

/** First reply to a new buyer: records response time and moves the lead out of "new". */
async function markResponded(leadId) {
  const now = new Date();
  await Lead.updateOne(
    { _id: leadId, firstResponseAt: { $exists: false } },
    { $set: { firstResponseAt: now } },
  );
  await Lead.updateOne({ _id: leadId, status: 'new' }, { $set: { status: 'engaged' } });
}

const assistantMessage = (text, extra = {}) => ({
  role: 'assistant',
  text: text.slice(0, 4000),
  createdAt: new Date(),
  ...extra,
});

/** Finds or creates the lead's conversation on a channel; a new one opens with a greeting. */
export async function openConversation({ leadId, channel = 'web' }) {
  const existing = await Conversation.findOne({ lead: leadId, channel });
  if (existing) return existing;

  const lead = await Lead.findById(leadId).select('name language').lean();
  if (!lead) throw new HttpError(404, 'Lead not found.');

  try {
    const conversation = await Conversation.create({
      lead: leadId,
      channel,
      messages: [{ role: 'assistant', text: greeting(lead.language, lead.name) }],
    });
    await markResponded(leadId);
    return conversation;
  } catch (err) {
    if (err.code === 11000) return Conversation.findOne({ lead: leadId, channel });
    throw err;
  }
}

/**
 * Opens the chat for a new buyer session. A returning buyer is greeted again
 * while the assistant is in charge; once a person has taken over they are not.
 */
export async function startBuyerSession({ leadId, channel = 'web' }) {
  const existed = await Conversation.exists({ lead: leadId, channel });
  const conversation = await openConversation({ leadId, channel });
  if (!existed || conversation.mode !== 'ai') return;

  const lead = await Lead.findById(leadId).select('name language').lean();
  await appendMessages(conversation._id, [assistantMessage(greeting(lead.language, lead.name))]);
}

/** STOP / START and messages from opted-out buyers, handled without the model in any mode. */
async function handleConsent(check, lead) {
  if (check.type === 'opt_out') {
    await Lead.updateOne({ _id: lead._id }, { $set: { optedOut: true, optedOutAt: new Date() } });
    return fixedReply('optedOut', lead.language);
  }
  if (check.type === 'opt_in') {
    await Lead.updateOne(
      { _id: lead._id },
      { $set: { optedOut: false }, $unset: { optedOutAt: 1 } },
    );
    return fixedReply('optedIn', lead.language);
  }
  return fixedReply('stillOptedOut', lead.language);
}

async function handOff({ provider, lead, project, conversation, text, reason, useModel = true }) {
  const summary = await summarizeForHandoff({
    provider,
    lead,
    project,
    messages: conversation.messages,
    latestText: text,
    useModel,
  });
  const { executive } = await handOffToHuman({
    leadId: lead._id,
    conversationId: conversation._id,
    reason,
    summary,
  });
  return handoffReply(lead.language, executive?.name, reason);
}

/** Replaces a reply containing numbers that nothing the model was given supports. */
async function checkReply(reply, transcript) {
  const projects = await Project.find({ isActive: true }).lean();
  const known = knownNumbers([
    ...transcript.map((m) => (typeof m.content === 'string' ? m.content : '')),
    JSON.stringify(projects.map(describeProject)),
  ]);
  return findUnverifiedNumbers(reply, known);
}

/**
 * Handles one buyer message. Order matters:
 * 1. Detect the language from the script and remember it.
 * 2. Consent (STOP / START / opted out) is decided by rules, never the model.
 * 3. If a person has taken over, only store the message.
 * 4. Pre-checks: price negotiation or asking for a person hands off at once.
 * 5. The agent turn; a failed or runaway turn hands off with a summary.
 * 6. Post-check: a reply with unsupported numbers is replaced and the chat flagged.
 */
export async function handleBuyerMessage({ leadId, channel = 'web', text, provider }) {
  const llm = provider ?? getLLMProvider();
  const conversation = await openConversation({ leadId, channel });
  const buyerMessage = { role: 'buyer', text, createdAt: new Date() };

  let lead = await Lead.findById(leadId).lean();
  const language = detectLanguage(text);
  if (language && language !== lead.language) {
    await Lead.updateOne({ _id: lead._id }, { $set: { language } });
    lead = { ...lead, language };
  }

  const finish = async (reply, { set, ...result } = {}) => {
    await appendMessages(conversation._id, reply ? [buyerMessage, reply] : [buyerMessage], set);
    if (reply) await markResponded(lead._id);
    const { mode } = await Conversation.findById(conversation._id).select('mode').lean();
    return { mode, reply, forcedHandoff: null, guardrail: null, ...result };
  };

  const check = runPreChecks({ text, lead });
  if (check && check.type !== 'handoff') {
    const reply = assistantMessage(await handleConsent(check, lead));
    return finish(reply, { guardrail: check.type });
  }

  if (conversation.mode === 'human') return finish(null);

  const [project, projects, upcomingVisit] = await Promise.all([
    lead.project ? Project.findById(lead.project).lean() : null,
    Project.find({ isActive: true }).select('code name').sort({ code: 1 }).lean(),
    Visit.findOne({ lead: leadId, status: 'booked' }).select('startsAt').lean(),
  ]);
  const handoffArgs = { provider: llm, lead, project, conversation, text };

  if (check?.type === 'handoff') {
    const replyText = await handOff({ ...handoffArgs, reason: check.reason });
    return finish(assistantMessage(replyText), { guardrail: `pre_check:${check.reason}` });
  }

  const turn = await runAgentTurn({
    provider: llm,
    messages: [
      { role: 'system', content: buildSystemPrompt({ lead, project, projects, upcomingVisit }) },
      ...toModelMessages(conversation.messages),
      { role: 'user', content: text },
    ],
    context: { leadId: lead._id, conversationId: conversation._id },
  });
  const toolCalls = turn.toolCalls.length ? turn.toolCalls : undefined;

  if (turn.forcedHandoff) {
    const replyText = await handOff({
      ...handoffArgs,
      reason: turn.forcedHandoff,
      // The provider just failed; do not wait on it again for the summary.
      useModel: turn.forcedHandoff !== 'assistant_error',
    });
    return finish(assistantMessage(replyText, { toolCalls }), {
      forcedHandoff: turn.forcedHandoff,
    });
  }

  const unverified = await checkReply(turn.reply, turn.transcript);
  if (unverified.length) {
    const reply = assistantMessage(fixedReply('unverified', lead.language), {
      toolCalls,
      flagged: true,
      flagReason: `Unverified numbers: ${unverified.join(', ')}`.slice(0, 200),
      blockedText: turn.reply.slice(0, 4000),
    });
    return finish(reply, { guardrail: 'unverified_numbers', set: { flagged: true } });
  }

  return finish(assistantMessage(turn.reply, { toolCalls }));
}

/** Messages the buyer may see: no tool internals, and only from their current session on. */
export async function getBuyerMessages({ leadId, channel = 'web', since }) {
  const conversation = await openConversation({ leadId, channel });
  return {
    mode: conversation.mode,
    messages: conversation.messages
      .filter((m) => m.role !== 'system' && (!since || m.createdAt >= since))
      .map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt })),
  };
}

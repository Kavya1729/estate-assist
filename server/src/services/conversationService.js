import { runAgentTurn } from '../ai/agent.js';
import { toModelMessages } from '../ai/history.js';
import { buildSystemPrompt } from '../ai/prompt.js';
import { getLLMProvider } from '../ai/providers/index.js';
import { greeting, handoffReply } from '../ai/replies.js';
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
async function appendMessages(conversationId, messages) {
  const now = new Date();
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $push: { messages: { $each: messages, $slice: -MAX_MESSAGES_PER_CONVERSATION } },
      $set: { lastMessageAt: now },
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
  await appendMessages(conversation._id, [
    { role: 'assistant', text: greeting(lead.language, lead.name), createdAt: new Date() },
  ]);
}

/**
 * Handles one buyer message: stores it, lets the assistant answer (unless a
 * person has taken over), and stores the reply with the tools it used.
 */
export async function handleBuyerMessage({ leadId, channel = 'web', text, provider }) {
  const conversation = await openConversation({ leadId, channel });
  const buyerMessage = { role: 'buyer', text, createdAt: new Date() };

  if (conversation.mode === 'human') {
    await appendMessages(conversation._id, [buyerMessage]);
    return { mode: 'human', reply: null };
  }

  const lead = await Lead.findById(leadId).lean();
  const [project, projects, upcomingVisit] = await Promise.all([
    lead.project ? Project.findById(lead.project).lean() : null,
    Project.find({ isActive: true }).select('code name').sort({ code: 1 }).lean(),
    Visit.findOne({ lead: leadId, status: 'booked' }).select('startsAt').lean(),
  ]);

  const turn = await runAgentTurn({
    provider: provider ?? getLLMProvider(),
    messages: [
      { role: 'system', content: buildSystemPrompt({ lead, project, projects, upcomingVisit }) },
      ...toModelMessages(conversation.messages),
      { role: 'user', content: text },
    ],
    context: { leadId: lead._id, conversationId: conversation._id },
  });

  let replyText = turn.reply;
  if (turn.forcedHandoff) {
    const { executive } = await handOffToHuman({
      leadId: lead._id,
      conversationId: conversation._id,
      reason: turn.forcedHandoff,
      summary: { needs: `Last buyer message: ${text.slice(0, 400)}` },
    });
    replyText = handoffReply(lead.language, executive?.name);
  }

  const reply = {
    role: 'assistant',
    text: replyText.slice(0, 4000),
    toolCalls: turn.toolCalls.length ? turn.toolCalls : undefined,
    createdAt: new Date(),
  };
  await appendMessages(conversation._id, [buyerMessage, reply]);
  await markResponded(lead._id);

  const { mode } = await Conversation.findById(conversation._id).select('mode').lean();
  return { mode, reply, forcedHandoff: turn.forcedHandoff };
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

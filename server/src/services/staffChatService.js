import { HttpError } from '../lib/httpError.js';
import { Conversation, Lead } from '../models/index.js';
import { appendMessages } from './conversationService.js';
import { canManageLead, findManageableLead, leadScope } from './leadAccess.js';

const systemNote = (text) => ({ role: 'system', text, createdAt: new Date() });

async function latestConversation(leadId) {
  const conversation = await Conversation.findOne({ lead: leadId }).sort({ lastMessageAt: -1 });
  if (!conversation) throw new HttpError(404, 'This lead has no conversation yet.');
  return conversation;
}

async function acknowledgeHandoff(lead) {
  await Lead.updateOne(
    {
      _id: lead._id,
      'handoff.at': { $exists: true },
      'handoff.acknowledgedAt': { $exists: false },
    },
    { $set: { 'handoff.acknowledgedAt': new Date() } },
  );
}

/** A staff member takes the chat over; the assistant stops replying until handed back. */
export async function takeOver(user, leadId) {
  const lead = await findManageableLead(user, leadId);
  const conversation = await latestConversation(lead._id);

  if (conversation.mode !== 'human' || !conversation.takenOverBy) {
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { mode: 'human', takenOverBy: user._id, takenOverAt: new Date() } },
    );
    await appendMessages(conversation._id, [systemNote(`${user.name} took over the chat`)]);
  }
  await acknowledgeHandoff(lead);
  return Conversation.findById(conversation._id);
}

/** Staff reply to the buyer. Replying takes the chat over if it was still with the assistant. */
export async function sendStaffMessage(user, leadId, text) {
  const conversation = await takeOver(user, leadId);
  const message = { role: 'staff', text, author: user._id, createdAt: new Date() };
  await appendMessages(conversation._id, [message]);
  await Lead.updateOne(
    { _id: leadId, firstResponseAt: { $exists: false } },
    { $set: { firstResponseAt: new Date() } },
  );
  await Lead.updateOne({ _id: leadId, status: 'new' }, { $set: { status: 'engaged' } });
  return message;
}

/** Hands the chat back to the assistant. */
export async function handBack(user, leadId) {
  const lead = await findManageableLead(user, leadId);
  const conversation = await latestConversation(lead._id);
  if (conversation.mode === 'ai') return conversation;

  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { mode: 'ai' }, $unset: { takenOverBy: 1, takenOverAt: 1 } },
  );
  await appendMessages(conversation._id, [
    systemNote(`${user.name} handed the chat back to the assistant`),
  ]);
  await acknowledgeHandoff(lead);
  return Conversation.findById(conversation._id);
}

/** Chats with a reply the guardrails blocked, waiting for someone to look at them. */
export async function listReviewQueue(user) {
  const scope = leadScope(user);
  const leadFilter = scope.assignedTo
    ? { lead: { $in: await Lead.find(scope).distinct('_id') } }
    : {};

  const conversations = await Conversation.find({
    ...leadFilter,
    flagged: true,
    reviewedAt: { $exists: false },
  })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .populate({
      path: 'lead',
      select: 'code name assignedTo',
      populate: { path: 'assignedTo', select: 'name' },
    })
    .lean();

  return conversations.map((c) => ({
    id: String(c._id),
    lead: c.lead && {
      id: String(c.lead._id),
      code: c.lead.code,
      name: c.lead.name ?? null,
      assignedTo: c.lead.assignedTo?.name ?? null,
    },
    mode: c.mode,
    lastMessageAt: c.lastMessageAt,
    flaggedMessages: c.messages
      .filter((m) => m.flagged)
      .map((m) => ({
        id: String(m._id),
        text: m.text,
        blockedText: m.blockedText ?? null,
        flagReason: m.flagReason ?? null,
        createdAt: m.createdAt,
      })),
  }));
}

export async function resolveReview(user, conversationId) {
  const conversation = await Conversation.findById(conversationId).populate('lead', 'assignedTo');
  if (!conversation || !conversation.flagged) throw new HttpError(404, 'Nothing to review here.');
  if (!canManageLead(user, conversation.lead ?? {})) {
    throw new HttpError(403, 'This lead is assigned to another sales executive.');
  }

  conversation.reviewedAt = new Date();
  conversation.reviewedBy = user._id;
  await conversation.save();
  return conversation;
}

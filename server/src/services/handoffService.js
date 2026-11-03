import { Conversation, Lead, Project, User } from '../models/index.js';
import { pickExecutive } from './assignmentService.js';
import { queueMessage } from './outboxService.js';

/**
 * Hands a buyer to a named sales executive: the lead gets an owner and a
 * summary, the assistant stops replying in this conversation, and the buyer is
 * told who will call. Calling it again for the same conversation is harmless.
 */
export async function handOffToHuman({ leadId, conversationId, reason, summary = {} }) {
  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error(`Lead ${leadId} not found for handoff`);

  if (!lead.assignedTo) {
    const owner = await pickExecutive(lead.project);
    if (owner) {
      lead.assignedTo = owner;
      lead.assignedAt = new Date();
    }
  }
  const executive = lead.assignedTo
    ? await User.findById(lead.assignedTo).select('name').lean()
    : null;

  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, mode: 'ai' },
    { $set: { mode: 'human' } },
    { returnDocument: 'after' },
  );
  const firstHandoff = Boolean(conversation);

  if (firstHandoff || !lead.handoff?.reason) {
    lead.handoff = { reason, at: new Date(), summary, acknowledgedAt: undefined };
  }
  await lead.save();

  if (firstHandoff && executive) {
    const project = lead.project ? await Project.findById(lead.project).lean() : null;
    await queueMessage({
      lead,
      template: 'handoff_notice',
      vars: { executive: executive.name, project: project?.name ?? 'your home search' },
      dedupeKey: `handoff_notice:${conversationId}`,
    });
  }

  return { executive: executive ? { id: String(executive._id), name: executive.name } : null };
}

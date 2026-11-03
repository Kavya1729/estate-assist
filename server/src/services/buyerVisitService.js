import { visitReply } from '../ai/replies.js';
import { HttpError } from '../lib/httpError.js';
import { formatVisitTime } from '../lib/time.js';
import { Lead, Project, Visit } from '../models/index.js';
import { appendMessages, openConversation } from './conversationService.js';
import { bookVisit, cancelVisit, rescheduleVisit } from './visitService.js';

/** What the confirmation page shows: time, place, map pin and RERA number. */
function visitView(visit, project) {
  return {
    id: String(visit._id),
    status: visit.status,
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    project: {
      code: project.code,
      name: project.name,
      reraNumber: project.reraNumber,
      address: project.location.address,
      city: project.location.city,
      mapUrl: project.location.mapUrl ?? null,
    },
  };
}

async function upcomingVisit(leadId) {
  return Visit.findOne({ lead: leadId, status: 'booked' }).lean();
}

/** Records the change in the chat so the buyer, the assistant and staff all see it. */
async function noteInChat(leadId, kind, visit, project) {
  const lead = await Lead.findById(leadId).select('language').lean();
  const conversation = await openConversation({ leadId });
  const text = visitReply(kind, lead.language, {
    project: project.name,
    when: formatVisitTime(visit.startsAt, lead.language),
  });
  await appendMessages(conversation._id, [{ role: 'assistant', text, createdAt: new Date() }]);
}

export async function getBuyerVisit(leadId) {
  const visit = await upcomingVisit(leadId);
  if (!visit) return null;
  const project = await Project.findById(visit.project).lean();
  return visitView(visit, project);
}

/**
 * Books the slot the buyer picked in the chat. A buyer who already has a
 * visit is moving it, so the old seat is released in the same transaction.
 */
export async function bookBuyerVisit(leadId, slotId) {
  const current = await upcomingVisit(leadId);
  const visit = current
    ? await rescheduleVisit({ visitId: current._id, slotId, bookedVia: 'assistant' })
    : await bookVisit({ leadId, slotId, bookedVia: 'assistant' });

  const project = await Project.findById(visit.project).lean();
  await noteInChat(leadId, 'booked', visit, project);
  return visitView(visit, project);
}

export async function cancelBuyerVisit(leadId) {
  const current = await upcomingVisit(leadId);
  if (!current) throw new HttpError(404, 'You have no upcoming site visit.');

  const visit = await cancelVisit({ visitId: current._id });
  const project = await Project.findById(visit.project).lean();
  await noteInChat(leadId, 'cancelled', visit, project);
  return visitView(visit, project);
}

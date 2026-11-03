import mongoose from 'mongoose';

import { HttpError } from '../lib/httpError.js';
import { Lead, Project, Slot, Visit } from '../models/index.js';
import { assertCanManageLead } from './leadAccess.js';
import { applyLeadScore } from './leadScoring.js';
import { visitMessageVars } from './messageTemplates.js';
import { queueMessage } from './outboxService.js';
import { BOOKING_CUTOFF_MINUTES, bookableSlotFilter, bookingCutoff } from './slotService.js';

const SLOT_TAKEN = 'That time was just taken. Please pick another slot.';
const ALREADY_BOOKED = 'This buyer already has a visit booked. Reschedule it instead.';

function isActiveVisitConflict(err) {
  return err?.code === 11000 && err.keyPattern?.lead === 1;
}

async function loadLead(leadId, actor, session) {
  const lead = await Lead.findById(leadId).session(session);
  if (!lead) throw new HttpError(404, 'Lead not found.');
  if (actor) assertCanManageLead(actor, lead);
  return lead;
}

async function loadBookedVisit(visitId, actor, session) {
  const visit = await Visit.findById(visitId).session(session);
  if (!visit) throw new HttpError(404, 'Visit not found.');
  const lead = await loadLead(visit.lead, actor, session);
  if (visit.status !== 'booked') {
    throw new HttpError(409, `This visit is already ${visit.status.replace('_', ' ')}.`);
  }
  return { visit, lead };
}

/**
 * Takes one seat in the slot. The conditional update (`bookedCount < capacity`)
 * is atomic in MongoDB, so two buyers racing for the last seat cannot both win.
 * The checks before it only exist to give a precise error message.
 */
async function claimSeat(slotId, lead, session) {
  const slot = await Slot.findById(slotId).session(session);
  if (!slot) throw new HttpError(404, 'Slot not found.');
  if (lead.project && !lead.project.equals(slot.project)) {
    throw new HttpError(400, 'That slot is for a different project.');
  }
  if (slot.isBlocked) throw new HttpError(409, 'That slot is no longer available.');
  if (slot.startsAt < bookingCutoff()) {
    throw new HttpError(
      400,
      `Visits must be booked at least ${BOOKING_CUTOFF_MINUTES} minutes in advance.`,
    );
  }

  const claimed = await Slot.findOneAndUpdate(
    { _id: slot._id, ...bookableSlotFilter() },
    { $inc: { bookedCount: 1 } },
    { returnDocument: 'after', session },
  );
  if (!claimed) throw new HttpError(409, SLOT_TAKEN, { reason: 'slot_full' });
  return claimed;
}

async function releaseSeat(slotId, session) {
  await Slot.updateOne(
    { _id: slotId, bookedCount: { $gt: 0 } },
    { $inc: { bookedCount: -1 } },
    { session },
  );
}

async function createVisit({ lead, slot, bookedVia }, session) {
  if (await Visit.exists({ lead: lead._id, status: 'booked' }).session(session)) {
    throw new HttpError(409, ALREADY_BOOKED);
  }

  const [visit] = await Visit.create(
    [
      {
        lead: lead._id,
        slot: slot._id,
        project: slot.project,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        bookedVia,
        assignedTo: lead.assignedTo,
      },
    ],
    { session },
  );

  const project = await Project.findById(slot.project).session(session).lean();
  lead.project = slot.project;
  lead.status = 'visit_booked';
  applyLeadScore(lead, project);
  await lead.save({ session });

  await queueMessage(
    {
      lead,
      visit,
      template: 'visit_confirmation',
      vars: visitMessageVars({ lead, project, visit }),
      dedupeKey: `visit_confirmation:${visit.id}`,
    },
    { session },
  );
  return visit;
}

/**
 * Runs `work` in a transaction: the seat, the visit, the lead's status and the
 * confirmation message are saved together or not at all. Write conflicts
 * between concurrent bookings are retried by the driver.
 */
async function inTransaction(work) {
  try {
    return await mongoose.connection.transaction((session) => work(session));
  } catch (err) {
    if (isActiveVisitConflict(err)) throw new HttpError(409, ALREADY_BOOKED);
    throw err;
  }
}

/** `actor` is the staff member booking, or null when the assistant books for the buyer. */
export function bookVisit({ leadId, slotId, bookedVia, actor = null }) {
  return inTransaction(async (session) => {
    const lead = await loadLead(leadId, actor, session);
    const slot = await claimSeat(slotId, lead, session);
    return createVisit({ lead, slot, bookedVia }, session);
  });
}

export function cancelVisit({ visitId, actor = null }) {
  return inTransaction(async (session) => {
    const { visit, lead } = await loadBookedVisit(visitId, actor, session);
    if (visit.startsAt <= new Date()) {
      throw new HttpError(400, 'This visit has already started. Record the outcome instead.');
    }

    visit.status = 'cancelled';
    visit.cancelledAt = new Date();
    await visit.save({ session });
    await releaseSeat(visit.slot, session);

    const project = await Project.findById(visit.project).session(session).lean();
    lead.status = 'engaged';
    applyLeadScore(lead, project);
    await lead.save({ session });
    return visit;
  });
}

/** Moves a booking to another slot; the old seat is only released if the new one is secured. */
export function rescheduleVisit({ visitId, slotId, bookedVia, actor = null }) {
  return inTransaction(async (session) => {
    const { visit, lead } = await loadBookedVisit(visitId, actor, session);
    if (visit.slot.equals(slotId)) throw new HttpError(400, 'The visit is already in that slot.');

    visit.status = 'cancelled';
    visit.cancelledAt = new Date();
    await visit.save({ session });
    await releaseSeat(visit.slot, session);

    const slot = await claimSeat(slotId, lead, session);
    return createVisit({ lead, slot, bookedVia }, session);
  });
}

export function recordVisitOutcome({ visitId, outcome, actor }) {
  return inTransaction(async (session) => {
    const { visit, lead } = await loadBookedVisit(visitId, actor, session);
    if (visit.startsAt > new Date()) {
      throw new HttpError(400, 'You can record the outcome once the visit has started.');
    }

    visit.status = outcome;
    visit.outcomeAt = new Date();
    await visit.save({ session });

    const project = await Project.findById(visit.project).session(session).lean();
    lead.status = outcome;
    applyLeadScore(lead, project);
    await lead.save({ session });
    return visit;
  });
}

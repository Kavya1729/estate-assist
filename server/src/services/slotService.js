import { HttpError } from '../lib/httpError.js';
import { MINUTE, addDays, istDateOf, istDateTime, istDayStart } from '../lib/time.js';
import { Project, Slot } from '../models/index.js';

/** The site team needs notice; slots starting sooner than this are not offered. */
export const BOOKING_CUTOFF_MINUTES = 60;
export const DEFAULT_VISIT_TIMES = Object.freeze([
  '10:00',
  '11:00',
  '12:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
]);
const MAX_SLOTS_RETURNED = 200;

export function bookingCutoff(now = new Date()) {
  return new Date(now.getTime() + BOOKING_CUTOFF_MINUTES * MINUTE);
}

/** Mongo filter for a slot that can still take one more booking. */
export function bookableSlotFilter(now = new Date()) {
  return {
    isBlocked: false,
    startsAt: { $gte: bookingCutoff(now) },
    $expr: { $lt: ['$bookedCount', '$capacity'] },
  };
}

export async function findActiveProject(code) {
  const project = await Project.findOne({ code, isActive: true }).lean();
  if (!project) throw new HttpError(404, 'Project not found.');
  return project;
}

/**
 * Slots a buyer can actually book: not blocked, not full and far enough ahead.
 * `from` is an IST calendar date; the window covers `days` whole days.
 */
export async function listFreeSlots(projectId, { from, days = 7, now = new Date() } = {}) {
  const fromDate = from ?? istDateOf(now);
  const windowStart = istDayStart(fromDate);
  const windowEnd = istDayStart(addDays(fromDate, days));
  const cutoff = bookingCutoff(now);

  const slots = await Slot.find({
    project: projectId,
    ...bookableSlotFilter(now),
    startsAt: { $gte: windowStart > cutoff ? windowStart : cutoff, $lt: windowEnd },
  })
    .sort({ startsAt: 1 })
    .limit(MAX_SLOTS_RETURNED);

  return slots.map((slot) => ({
    id: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    remaining: slot.remaining,
  }));
}

/**
 * Creates the standard daily slots for a project. Idempotent: existing slots
 * (and their bookings) are left untouched, so it is safe to run repeatedly.
 */
export async function generateSlots(
  project,
  { from, days = 14, times = DEFAULT_VISIT_TIMES, capacity = 2 } = {},
) {
  const startDate = from ?? istDateOf(new Date());
  const durationMs = (project.visitDurationMinutes ?? 45) * MINUTE;

  const operations = [];
  for (let day = 0; day < days; day += 1) {
    const date = addDays(startDate, day);
    for (const time of times) {
      const startsAt = istDateTime(date, time);
      operations.push({
        updateOne: {
          filter: { project: project._id, startsAt },
          update: {
            $setOnInsert: {
              project: project._id,
              startsAt,
              endsAt: new Date(startsAt.getTime() + durationMs),
              capacity,
              bookedCount: 0,
              isBlocked: false,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (!operations.length) return 0;
  const result = await Slot.bulkWrite(operations, { ordered: false });
  return result.upsertedCount;
}

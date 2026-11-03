import { DAY, HOUR } from '../lib/time.js';
import { Visit } from '../models/index.js';
import { visitMessageVars } from './messageTemplates.js';
import { queueMessage } from './outboxService.js';

const REMINDER_BATCH = 500;

/**
 * - Day-before: visits starting in 2h to 24h, booked at least a day ahead
 *   (a later booking has just received its confirmation, so it would be noise).
 * - Two-hours-before: visits starting within 2h.
 */
const REMINDERS = [
  {
    template: 'reminder_24h',
    sentField: 'reminders.dayBeforeSentAt',
    filter: (now) => ({
      startsAt: { $gt: new Date(now.getTime() + 2 * HOUR), $lte: new Date(now.getTime() + DAY) },
      $expr: { $lte: ['$createdAt', { $subtract: ['$startsAt', DAY] }] },
    }),
  },
  {
    template: 'reminder_2h',
    sentField: 'reminders.twoHoursBeforeSentAt',
    filter: (now) => ({
      startsAt: { $gt: now, $lte: new Date(now.getTime() + 2 * HOUR) },
    }),
  },
];

/**
 * Queues the reminders that are due. Safe to run as often as we like and from
 * more than one instance: the outbox `dedupeKey` makes each reminder unique,
 * and the visit is only marked once its message exists.
 */
export async function queueDueReminders(now = new Date()) {
  const queued = { reminder_24h: 0, reminder_2h: 0 };

  for (const { template, sentField, filter } of REMINDERS) {
    const visits = await Visit.find({
      status: 'booked',
      [sentField]: { $exists: false },
      ...filter(now),
    })
      .sort({ startsAt: 1 })
      .limit(REMINDER_BATCH)
      .populate('lead')
      .populate('project');

    for (const visit of visits) {
      if (!visit.lead || !visit.project) continue;
      const message = await queueMessage({
        lead: visit.lead,
        visit,
        template,
        vars: visitMessageVars({ lead: visit.lead, project: visit.project, visit }),
        dedupeKey: `${template}:${visit.id}`,
      });
      await Visit.updateOne({ _id: visit._id }, { $set: { [sentField]: now } });
      if (message) queued[template] += 1;
    }
  }

  return queued;
}

import { beforeEach, describe, expect, it } from 'vitest';

import { Outbox, Visit } from '../../src/models/index.js';
import { dispatchQueued } from '../../src/services/outboxService.js';
import { queueDueReminders } from '../../src/services/reminderService.js';
import { bookVisit, cancelVisit } from '../../src/services/visitService.js';
import { useTestDatabase } from '../helpers/db.js';
import { HOUR, createLead, createProject, createSlot } from '../helpers/factories.js';

useTestDatabase();

let project;

beforeEach(async () => {
  project = await createProject();
});

async function bookIn(hours, leadOverrides = {}) {
  const lead = await createLead(project, leadOverrides);
  const slot = await createSlot(project, { startsAt: new Date(Date.now() + hours * HOUR) });
  return bookVisit({ leadId: lead._id, slotId: slot._id, bookedVia: 'assistant' });
}

const at = (visit, hoursBefore) => new Date(visit.startsAt.getTime() - hoursBefore * HOUR);
const reminders = () => Outbox.find({ template: /^reminder/ }).sort({ createdAt: 1 });

describe('queueDueReminders', () => {
  it('sends the day-before reminder inside the 24-hour window, once', async () => {
    const visit = await bookIn(72);

    expect(await queueDueReminders(at(visit, 30))).toEqual({ reminder_24h: 0, reminder_2h: 0 });
    expect(await queueDueReminders(at(visit, 20))).toEqual({ reminder_24h: 1, reminder_2h: 0 });
    expect(await queueDueReminders(at(visit, 19))).toEqual({ reminder_24h: 0, reminder_2h: 0 });

    const [message] = await reminders();
    expect(message.template).toBe('reminder_24h');
    expect((await Visit.findById(visit._id)).reminders.dayBeforeSentAt).toBeInstanceOf(Date);
  });

  it('sends the two-hour reminder close to the visit', async () => {
    const visit = await bookIn(72);
    await queueDueReminders(at(visit, 20));

    expect(await queueDueReminders(at(visit, 1.5))).toEqual({ reminder_24h: 0, reminder_2h: 1 });
    expect((await reminders()).map((m) => m.template)).toEqual(['reminder_24h', 'reminder_2h']);
  });

  it('skips the day-before reminder for a visit booked less than a day ahead', async () => {
    const visit = await bookIn(10);

    expect(await queueDueReminders(at(visit, 9))).toEqual({ reminder_24h: 0, reminder_2h: 0 });
    expect(await queueDueReminders(at(visit, 1))).toEqual({ reminder_24h: 0, reminder_2h: 1 });
  });

  it('does not remind cancelled visits', async () => {
    const visit = await bookIn(72);
    await cancelVisit({ visitId: visit._id });

    expect(await queueDueReminders(at(visit, 20))).toEqual({ reminder_24h: 0, reminder_2h: 0 });
  });

  it('is idempotent when two runs overlap', async () => {
    const visit = await bookIn(72);

    await Promise.all([queueDueReminders(at(visit, 20)), queueDueReminders(at(visit, 20))]);

    expect(await Outbox.countDocuments({ template: 'reminder_24h' })).toBe(1);
  });

  it('records but does not send reminders to opted-out buyers', async () => {
    const visit = await bookIn(72, { optedOut: true, optedOutAt: new Date() });

    await queueDueReminders(at(visit, 20));

    const [message] = await reminders();
    expect(message.status).toBe('skipped_opt_out');
  });
});

describe('dispatchQueued', () => {
  it('marks queued messages as sent and leaves suppressed ones alone', async () => {
    await bookIn(72);
    await bookIn(72.5, { optedOut: true, optedOutAt: new Date() });

    expect(await dispatchQueued()).toBe(1);
    expect(await Outbox.countDocuments({ status: 'sent', sentAt: { $type: 'date' } })).toBe(1);
    expect(await Outbox.countDocuments({ status: 'skipped_opt_out' })).toBe(1);
    expect(await dispatchQueued()).toBe(0);
  });
});

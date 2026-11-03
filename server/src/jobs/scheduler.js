import cron from 'node-cron';

import { IST_TIME_ZONE } from '../lib/time.js';
import { dispatchQueued } from '../services/outboxService.js';
import { queueDueReminders } from '../services/reminderService.js';

/** Every minute, so a booking confirmation goes out within a minute of being queued. */
const EVERY_MINUTE = '* * * * *';

async function runMessaging() {
  try {
    const queued = await queueDueReminders();
    const sent = await dispatchQueued();
    if (queued.reminder_24h || queued.reminder_2h || sent) {
      console.log(
        `[messaging] queued ${queued.reminder_24h} day-before, ${queued.reminder_2h} two-hour; sent ${sent}`,
      );
    }
  } catch (err) {
    console.error(`[messaging] run failed: ${err.message}`);
  }
}

/** Starts background jobs in the API process. Returns a function that stops them. */
export function startJobs() {
  const tasks = [
    cron.schedule(EVERY_MINUTE, runMessaging, {
      name: 'visit-messaging',
      timezone: IST_TIME_ZONE,
      noOverlap: true,
    }),
  ];
  runMessaging();
  return () => Promise.all(tasks.map((task) => task.stop()));
}

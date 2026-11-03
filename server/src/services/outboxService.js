import { Outbox } from '../models/index.js';
import { renderMessage } from './messageTemplates.js';

const DISPATCH_BATCH = 100;

function isDuplicateKey(err) {
  return err?.code === 11000;
}

/**
 * Queues a WhatsApp message for a lead. Opted-out buyers get a record with
 * `skipped_opt_out` (so staff can see it was suppressed) and nothing is sent.
 * Leads without a phone number cannot receive WhatsApp, so nothing is queued.
 * With a `dedupeKey`, queueing the same message twice is a no-op.
 */
export async function queueMessage({ lead, visit, template, vars, dedupeKey }, { session } = {}) {
  if (!lead.normalizedPhone) return null;

  const doc = {
    lead: lead._id,
    visit: visit?._id,
    template,
    to: `+91${lead.normalizedPhone}`,
    body: renderMessage(template, lead.language, vars),
    status: lead.optedOut ? 'skipped_opt_out' : 'queued',
    dedupeKey,
  };

  try {
    const [message] = await Outbox.create([doc], { session });
    return message;
  } catch (err) {
    if (isDuplicateKey(err) && dedupeKey) return null;
    throw err;
  }
}

/**
 * Stand-in for the WhatsApp Business API: marks queued messages as sent.
 * A real sender would call the provider per message and record failures.
 */
export async function dispatchQueued({ now = new Date() } = {}) {
  const batch = await Outbox.find({ status: 'queued' })
    .sort({ createdAt: 1 })
    .limit(DISPATCH_BATCH)
    .select('_id')
    .lean();
  if (!batch.length) return 0;

  const { modifiedCount } = await Outbox.updateMany(
    { _id: { $in: batch.map((m) => m._id) }, status: 'queued' },
    { $set: { status: 'sent', sentAt: now } },
  );
  return modifiedCount;
}

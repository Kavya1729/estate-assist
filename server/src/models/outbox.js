import mongoose from 'mongoose';

import { OUTBOX_STATUSES, OUTBOX_TEMPLATES } from '../constants/domain.js';
import { toJSON } from './plugins/toJSON.js';

/**
 * Simulated WhatsApp/SMS messages. Nothing leaves the system; the staff console
 * shows this collection so reviewers can see what a buyer would have received.
 */
const outboxSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' },
    channel: { type: String, enum: ['whatsapp', 'sms'], default: 'whatsapp' },
    template: { type: String, enum: OUTBOX_TEMPLATES, required: true },
    to: { type: String, required: true },
    body: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: OUTBOX_STATUSES, default: 'queued' },
    sentAt: { type: Date },

    /** e.g. `reminder_24h:<visitId>`; the unique index makes every send idempotent. */
    dedupeKey: { type: String },
  },
  { timestamps: true },
);

outboxSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
outboxSchema.index({ lead: 1, createdAt: -1 });

outboxSchema.plugin(toJSON);

export const Outbox = mongoose.model('Outbox', outboxSchema, 'outbox');

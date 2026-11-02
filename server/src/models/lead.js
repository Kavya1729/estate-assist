import mongoose from 'mongoose';

import {
  BUYING_TIMELINES,
  HANDOFF_REASONS,
  LANGUAGES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_TEMPERATURES,
} from '../constants/domain.js';
import { normalizeIndianMobile } from '../lib/phone.js';
import { nextSequence } from './counter.js';
import { toJSON } from './plugins/toJSON.js';

const LEAD_CODE_START = 58_200;

const sourceTouchSchema = new mongoose.Schema(
  {
    source: { type: String, enum: LEAD_SOURCES, required: true },
    receivedAt: { type: Date, default: Date.now },
    campaign: { type: String, trim: true, maxlength: 80 },
    externalRef: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const duplicateFlagSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    reason: { type: String, enum: ['similar_name', 'same_email'], required: true },
    resolution: { type: String, enum: ['open', 'merged', 'ignored'], default: 'open' },
    flaggedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const leadSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    name: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 20 },
    normalizedPhone: { type: String },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },

    /** First touch decides attribution in the dashboard; later touches are kept for context. */
    primarySource: { type: String, enum: LEAD_SOURCES, required: true },
    sources: { type: [sourceTouchSchema], default: [] },

    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    profile: {
      bhk: { type: Number, min: 1, max: 6 },
      budgetMin: { type: Number, min: 0 },
      budgetMax: { type: Number, min: 0 },
      timeline: { type: String, enum: BUYING_TIMELINES, default: 'unknown' },
      notes: { type: String, trim: true, maxlength: 500 },
    },
    language: { type: String, enum: LANGUAGES, default: 'en' },

    score: { type: Number, min: 0, max: 100, default: 0 },
    temperature: { type: String, enum: LEAD_TEMPERATURES, default: 'cold' },
    status: { type: String, enum: LEAD_STATUSES, default: 'new' },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },

    handoff: {
      reason: { type: String, enum: HANDOFF_REASONS },
      at: { type: Date },
      summary: {
        needs: { type: String, maxlength: 500 },
        budget: { type: String, maxlength: 120 },
        questions: [{ type: String, maxlength: 300 }],
        concerns: [{ type: String, maxlength: 300 }],
      },
    },

    consent: {
      given: { type: Boolean, default: false },
      at: { type: Date },
    },
    optedOut: { type: Boolean, default: false },
    optedOutAt: { type: Date },

    possibleDuplicates: { type: [duplicateFlagSchema], default: [] },

    firstInboundAt: { type: Date, default: Date.now },
    firstResponseAt: { type: Date },
  },
  { timestamps: true },
);

leadSchema.index(
  { normalizedPhone: 1 },
  { unique: true, partialFilterExpression: { normalizedPhone: { $type: 'string' } } },
);
leadSchema.index({ email: 1 }, { partialFilterExpression: { email: { $type: 'string' } } });
leadSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 });
leadSchema.index({ primarySource: 1, createdAt: -1 });
leadSchema.index({ temperature: 1, updatedAt: -1 });
leadSchema.index({ 'possibleDuplicates.resolution': 1 });

leadSchema.pre('validate', function prepare() {
  if (this.isModified('phone')) {
    this.normalizedPhone = this.phone ? normalizeIndianMobile(this.phone) : undefined;
    if (this.phone && !this.normalizedPhone) {
      this.invalidate('phone', 'Enter a valid 10-digit Indian mobile number');
    }
  }

  const { budgetMin, budgetMax } = this.profile ?? {};
  if (budgetMin != null && budgetMax != null && budgetMax < budgetMin) {
    this.invalidate('profile.budgetMax', 'budgetMax must be greater than or equal to budgetMin');
  }
});

/** Runs after validation, so rejected leads never consume a code. */
leadSchema.pre('save', async function assignCode() {
  if (this.isNew && !this.code) {
    this.code = `LD-${await nextSequence('lead', { start: LEAD_CODE_START })}`;
  }
});

leadSchema.plugin(toJSON);

export const Lead = mongoose.model('Lead', leadSchema);

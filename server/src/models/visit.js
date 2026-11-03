import mongoose from 'mongoose';

import { VISIT_STATUSES } from '../constants/domain.js';
import { toJSON } from './plugins/toJSON.js';

const visitSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },

    /** Copied from the slot so the reminder job and lists can read visits without a join. */
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },

    status: { type: String, enum: VISIT_STATUSES, default: 'booked' },
    bookedVia: { type: String, enum: ['assistant', 'staff'], required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    reminders: {
      dayBeforeSentAt: { type: Date },
      twoHoursBeforeSentAt: { type: Date },
    },

    cancelledAt: { type: Date },
    outcomeAt: { type: Date },
  },
  { timestamps: true },
);

/** A buyer can hold only one upcoming visit at a time. */
visitSchema.index(
  { lead: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'booked' },
    name: 'one_active_visit_per_lead',
  },
);
visitSchema.index({ status: 1, startsAt: 1 });
visitSchema.index({ slot: 1 });
visitSchema.index({ project: 1, startsAt: -1 });

visitSchema.plugin(toJSON);

export const Visit = mongoose.model('Visit', visitSchema);

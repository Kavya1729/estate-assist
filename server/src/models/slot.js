import mongoose from 'mongoose';

import { toJSON } from './plugins/toJSON.js';

/**
 * A site-visit window. `capacity` is how many families the site team can host
 * at once; `bookedCount` only ever changes through a conditional atomic update
 * (`bookedCount < capacity`), which is what prevents double booking.
 */
const slotSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1, max: 20, default: 2 },
    bookedCount: { type: Number, default: 0, min: 0 },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

slotSchema.pre('validate', function checkSlot() {
  if (this.endsAt <= this.startsAt) this.invalidate('endsAt', 'endsAt must be after startsAt');
  if (this.bookedCount > this.capacity) {
    this.invalidate('bookedCount', 'bookedCount cannot exceed capacity');
  }
});

slotSchema.index({ project: 1, startsAt: 1 }, { unique: true });
slotSchema.index({ startsAt: 1 });

slotSchema.virtual('remaining').get(function remaining() {
  return Math.max(this.capacity - this.bookedCount, 0);
});

slotSchema.plugin(toJSON);

export const Slot = mongoose.model('Slot', slotSchema);

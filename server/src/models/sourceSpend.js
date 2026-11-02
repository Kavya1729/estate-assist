import mongoose from 'mongoose';

import { LEAD_SOURCES } from '../constants/domain.js';
import { toJSON } from './plugins/toJSON.js';

/** Monthly marketing spend per lead source, used for cost per visit on the dashboard. */
const sourceSpendSchema = new mongoose.Schema(
  {
    source: { type: String, enum: LEAD_SOURCES, required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

sourceSpendSchema.index({ source: 1, month: 1 }, { unique: true });

sourceSpendSchema.plugin(toJSON);

export const SourceSpend = mongoose.model('SourceSpend', sourceSpendSchema);

import mongoose from 'mongoose';

import { toJSON } from './plugins/toJSON.js';

const rangeSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

rangeSchema.pre('validate', function ensureOrdered() {
  if (this.max < this.min) this.invalidate('max', 'max must be greater than or equal to min');
});

const configurationSchema = new mongoose.Schema(
  {
    bhk: { type: Number, required: true, min: 1, max: 6 },
    carpetAreaSqft: { type: rangeSchema, required: true },
    priceRange: { type: rangeSchema, required: true },
    unitsAvailable: { type: Number, min: 0 },
  },
  { _id: false },
);

/**
 * One fact the assistant may state. The assistant answers only from these
 * entries; anything not covered here is handed to a person.
 */
const factSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, match: /^[a-z0-9_]+$/ },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    reraNumber: { type: String, required: true, trim: true, maxlength: 60 },
    tagline: { type: String, trim: true, maxlength: 160 },
    location: {
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      mapUrl: { type: String, trim: true },
    },
    configurations: { type: [configurationSchema], default: [] },
    facts: { type: [factSchema], default: [] },
    possessionDate: { type: Date },
    visitDurationMinutes: { type: Number, default: 45, min: 15, max: 180 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

projectSchema.path('facts').validate(function uniqueFactKeys(facts) {
  return new Set(facts.map((f) => f.key)).size === facts.length;
}, 'Fact keys must be unique within a project');

projectSchema.plugin(toJSON);

export const Project = mongoose.model('Project', projectSchema);

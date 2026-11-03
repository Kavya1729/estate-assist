import { z } from 'zod';

import {
  BUYING_TIMELINES,
  LANGUAGES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_TEMPERATURES,
} from '../constants/domain.js';
import { normalizeIndianMobile } from '../lib/phone.js';
import { objectId } from './common.js';

/** Lead sources often send "" for fields they do not have; treat that as missing. */
const optional = (schema) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

const rupees = z.number({ error: 'Enter an amount in rupees' }).int().min(0).max(100_00_00_000);

export const ingestParamsSchema = z.object({
  source: z.enum(LEAD_SOURCES, { error: `Source must be one of: ${LEAD_SOURCES.join(', ')}` }),
});

export const ingestBodySchema = z
  .object({
    name: optional(z.string().trim().min(1).max(80)),
    phone: optional(
      z
        .string()
        .trim()
        .max(20)
        .refine(
          (value) => normalizeIndianMobile(value),
          'Enter a valid 10-digit Indian mobile number',
        ),
    ),
    email: optional(z.string().trim().toLowerCase().max(120).email('Enter a valid email address')),
    projectCode: optional(z.string().trim().toUpperCase().max(10)),
    bhk: optional(z.number().int().min(1).max(6)),
    budgetMin: optional(rupees),
    budgetMax: optional(rupees),
    timeline: optional(z.enum(BUYING_TIMELINES)),
    language: optional(z.enum(LANGUAGES)),
    notes: optional(z.string().trim().max(500)),
    campaign: optional(z.string().trim().max(80)),
    externalRef: optional(z.string().trim().max(80)),
    consent: optional(z.boolean()),
  })
  .refine((lead) => lead.phone || lead.email, {
    path: ['phone'],
    message: 'Provide a phone number or an email address',
  })
  .refine(
    (lead) => lead.budgetMin == null || lead.budgetMax == null || lead.budgetMax >= lead.budgetMin,
    { path: ['budgetMax'], message: 'budgetMax must be greater than or equal to budgetMin' },
  );

/** Statuses staff may set by hand; visit statuses change only through the visit endpoints. */
export const MANUAL_LEAD_STATUSES = Object.freeze(['new', 'engaged', 'lost']);

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['recent', 'score', 'created']).default('recent'),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(LEAD_TEMPERATURES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  projectCode: z.string().trim().toUpperCase().max(10).optional(),
  assignedTo: z.union([z.literal('unassigned'), objectId('executive id')]).optional(),
  handoff: z.literal('pending').optional(),
  duplicates: z.literal('open').optional(),
  q: z.string().trim().min(1).max(80).optional(),
});

/** `null` clears a profile field. */
const clearable = (schema) => schema.nullable().optional();

export const updateLeadSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    status: z.enum(MANUAL_LEAD_STATUSES).optional(),
    language: z.enum(LANGUAGES).optional(),
    projectCode: z.string().trim().toUpperCase().max(10).optional(),
    bhk: clearable(z.number().int().min(1).max(6)),
    budgetMin: clearable(rupees),
    budgetMax: clearable(rupees),
    timeline: z.enum(BUYING_TIMELINES).optional(),
    notes: clearable(z.string().trim().max(500)),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update' })
  .refine((p) => p.budgetMin == null || p.budgetMax == null || p.budgetMax >= p.budgetMin, {
    path: ['budgetMax'],
    message: 'budgetMax must be greater than or equal to budgetMin',
  });

export const assignLeadSchema = z.object({ executiveId: objectId('executive id') });

export const duplicateParamsSchema = z.object({
  id: objectId('lead id'),
  otherId: objectId('duplicate lead id'),
});

export const resolveDuplicateSchema = z.object({
  resolution: z.enum(['merged', 'ignored'], { error: 'Resolution must be merged or ignored' }),
});

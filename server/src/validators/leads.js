import { z } from 'zod';

import { BUYING_TIMELINES, LANGUAGES, LEAD_SOURCES } from '../constants/domain.js';
import { normalizeIndianMobile } from '../lib/phone.js';

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

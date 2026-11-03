import { z } from 'zod';

import { isoDate } from './common.js';

const LAKH = 100_000;

const range = (label, max) =>
  z
    .object({ min: z.number().min(0).max(max), max: z.number().min(0).max(max) })
    .refine((r) => r.max >= r.min, { message: `${label}: max must be at least min` });

const configurationSchema = z.object({
  bhk: z.number().int().min(1).max(6),
  carpetAreaSqft: range('Carpet area', 20_000),
  priceRange: range('Price', 100 * 100 * LAKH),
  unitsAvailable: z.number().int().min(0).max(10_000).optional(),
});

const factSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, 'Fact keys use lowercase letters, digits and _'),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(1000),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    tagline: z.string().trim().max(160).optional(),
    possessionDate: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
    configurations: z.array(configurationSchema).max(10).optional(),
    facts: z
      .array(factSchema)
      .max(60)
      .refine((facts) => new Set(facts.map((f) => f.key)).size === facts.length, {
        message: 'Fact keys must be unique',
      })
      .optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update' });

export const generateSlotsSchema = z.object({
  from: isoDate().optional(),
  days: z.number().int().min(1).max(30).default(14),
  times: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Times look like 10:00 or 16:30'))
    .min(1)
    .max(12)
    .optional(),
  capacity: z.number().int().min(1).max(20).default(2),
});

export const updateSlotSchema = z
  .object({
    isBlocked: z.boolean().optional(),
    capacity: z.number().int().min(1).max(20).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update' });

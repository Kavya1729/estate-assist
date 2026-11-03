import { z } from 'zod';

import { MAX_SLOT_DAYS_AHEAD } from '../constants/domain.js';

export const projectCodeParamsSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(10),
});

export const freeSlotsQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-04')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a real date')
    .optional(),
  days: z.coerce.number().int().min(1).max(MAX_SLOT_DAYS_AHEAD).default(7),
});

import { z } from 'zod';

import { MAX_SLOT_DAYS_AHEAD } from '../constants/domain.js';
import { isoDate } from './common.js';

export const projectCodeParamsSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(10),
});

export const freeSlotsQuerySchema = z.object({
  from: isoDate().optional(),
  days: z.coerce.number().int().min(1).max(MAX_SLOT_DAYS_AHEAD).default(7),
});

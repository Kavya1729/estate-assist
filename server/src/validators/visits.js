import { z } from 'zod';

import { VISIT_OUTCOMES } from '../constants/domain.js';
import { objectId } from './common.js';

export const bookVisitSchema = z.object({
  leadId: objectId('lead id'),
  slotId: objectId('slot id'),
});

export const rescheduleVisitSchema = z.object({
  slotId: objectId('slot id'),
});

export const visitOutcomeSchema = z.object({
  outcome: z.enum(VISIT_OUTCOMES, {
    error: `Outcome must be one of: ${VISIT_OUTCOMES.join(', ')}`,
  }),
});

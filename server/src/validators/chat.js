import { z } from 'zod';

import { LANGUAGES } from '../constants/domain.js';
import { normalizeIndianMobile } from '../lib/phone.js';
import { objectId } from './common.js';

export const startChatSchema = z.object({
  name: z.string({ error: 'Enter your name' }).trim().min(1, 'Enter your name').max(80),
  phone: z
    .string({ error: 'Enter your mobile number' })
    .trim()
    .max(20)
    .refine((value) => normalizeIndianMobile(value), 'Enter a valid 10-digit Indian mobile number'),
  projectCode: z.string().trim().toUpperCase().max(10).optional(),
  language: z.enum(LANGUAGES).optional(),
  consent: z.literal(true, { error: 'Please agree to be contacted about your enquiry' }),
});

export const buyerVisitSchema = z.object({ slotId: objectId('slot id') });

export const chatMessageSchema = z.object({
  text: z
    .string({ error: 'Type a message' })
    .trim()
    .min(1, 'Type a message')
    .max(1000, 'Keep messages under 1000 characters'),
});

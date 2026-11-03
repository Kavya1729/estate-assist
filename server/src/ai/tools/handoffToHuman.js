import { z } from 'zod';

import { handOffToHuman } from '../../services/handoffService.js';

/** Reasons the model may choose; `assistant_error` and `tool_limit` are set by the system. */
const MODEL_REASONS = ['buyer_requested', 'price_or_discount', 'missing_fact', 'hot_lead'];

export const handoffToHuman = {
  name: 'handoff_to_human',
  description:
    'Hand the buyer to their sales executive. Use when they ask for a person, ask about discounts or negotiation, ask something the fact sheet does not cover, or are ready to buy. Write the summary for the executive.',
  schema: z
    .object({
      reason: z.enum(MODEL_REASONS),
      summary: z
        .object({
          needs: z.string().trim().max(500).describe('What the buyer is looking for'),
          budget: z.string().trim().max(120).optional(),
          questions: z.array(z.string().trim().max(300)).max(5).optional(),
          concerns: z.array(z.string().trim().max(300)).max(5).optional(),
        })
        .strict(),
    })
    .strict(),

  async run({ reason, summary }, { leadId, conversationId }) {
    const { executive } = await handOffToHuman({ leadId, conversationId, reason, summary });
    return { ok: true, handedOff: true, executive: executive?.name ?? null };
  },
};

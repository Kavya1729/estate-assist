import { Router } from 'express';

import { requireIngestAccess } from '../middleware/ingestAuth.js';
import { validate } from '../middleware/validate.js';
import { ingestLead } from '../services/leadService.js';
import { ingestBodySchema, ingestParamsSchema } from '../validators/leads.js';

const router = Router();

/**
 * Simulates the portal, ad, website and hoarding-call feeds. Returns only what
 * the caller needs to reconcile, never the stored buyer details.
 */
router.post(
  '/ingest/:source',
  requireIngestAccess,
  validate({ params: ingestParamsSchema, body: ingestBodySchema }),
  async (req, res) => {
    const { outcome, matchedBy, lead } = await ingestLead(req.valid.params.source, req.valid.body);

    res.status(outcome === 'created' ? 201 : 200).json({
      outcome,
      matchedBy,
      lead: {
        id: lead.id,
        code: lead.code,
        temperature: lead.temperature,
        assigned: Boolean(lead.assignedTo),
        possibleDuplicates: lead.possibleDuplicates.length,
      },
    });
  },
);

export default router;

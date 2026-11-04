import { Router } from 'express';

import { ROLES } from '../constants/domain.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireIngestAccess } from '../middleware/ingestAuth.js';
import { validate } from '../middleware/validate.js';
import { assignLead, resolveDuplicate, updateLead } from '../services/leadAdminService.js';
import { getLeadDetail, listDuplicatePairs, listLeads } from '../services/leadQueryService.js';
import { ingestLead } from '../services/leadService.js';
import { handBack, sendStaffMessage, takeOver } from '../services/staffChatService.js';
import { chatMessageSchema } from '../validators/chat.js';
import { idParamsSchema } from '../validators/common.js';
import {
  assignLeadSchema,
  duplicateParamsSchema,
  ingestBodySchema,
  ingestParamsSchema,
  listLeadsQuerySchema,
  resolveDuplicateSchema,
  updateLeadSchema,
} from '../validators/leads.js';

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

router.use(requireAuth);

router.get('/', validate({ query: listLeadsQuerySchema }), async (req, res) => {
  res.json(await listLeads(req.user, req.valid.query));
});

router.get('/duplicates', async (req, res) => {
  res.json({ items: await listDuplicatePairs(req.user) });
});

router.get('/:id', validate({ params: idParamsSchema }), async (req, res) => {
  res.json(await getLeadDetail(req.user, req.valid.params.id));
});

router.patch(
  '/:id',
  validate({ params: idParamsSchema, body: updateLeadSchema }),
  async (req, res) => {
    const lead = await updateLead(req.user, req.valid.params.id, req.valid.body);
    res.json({ lead });
  },
);

router.post(
  '/:id/assign',
  requireRole(ROLES.SALES_HEAD),
  validate({ params: idParamsSchema, body: assignLeadSchema }),
  async (req, res) => {
    const lead = await assignLead(req.valid.params.id, req.valid.body.executiveId);
    res.json({ lead });
  },
);

router.post(
  '/:id/duplicates/:otherId',
  validate({ params: duplicateParamsSchema, body: resolveDuplicateSchema }),
  async (req, res) => {
    const { id, otherId } = req.valid.params;
    const lead = await resolveDuplicate(req.user, id, otherId, req.valid.body.resolution);
    res.json({ lead });
  },
);

router.post('/:id/takeover', validate({ params: idParamsSchema }), async (req, res) => {
  const conversation = await takeOver(req.user, req.valid.params.id);
  res.json({ conversation });
});

router.post('/:id/handback', validate({ params: idParamsSchema }), async (req, res) => {
  const conversation = await handBack(req.user, req.valid.params.id);
  res.json({ conversation });
});

router.post(
  '/:id/messages',
  validate({ params: idParamsSchema, body: chatMessageSchema }),
  async (req, res) => {
    const message = await sendStaffMessage(req.user, req.valid.params.id, req.valid.body.text);
    res
      .status(201)
      .json({ message: { role: message.role, text: message.text, createdAt: message.createdAt } });
  },
);

export default router;

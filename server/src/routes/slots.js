import { Router } from 'express';

import { ROLES } from '../constants/domain.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateSlot } from '../services/projectAdminService.js';
import { idParamsSchema } from '../validators/common.js';
import { updateSlotSchema } from '../validators/projects.js';

const router = Router();

router.patch(
  '/:id',
  requireAuth,
  requireRole(ROLES.SALES_HEAD),
  validate({ params: idParamsSchema, body: updateSlotSchema }),
  async (req, res) => {
    res.json({ slot: await updateSlot(req.valid.params.id, req.valid.body) });
  },
);

export default router;

import { Router } from 'express';

import { IST_TIME_ZONE } from '../lib/time.js';
import { validate } from '../middleware/validate.js';
import { findActiveProject, listFreeSlots } from '../services/slotService.js';
import { freeSlotsQuerySchema, projectCodeParamsSchema } from '../validators/slots.js';

const router = Router();

/** Public: the buyer's slot picker and the assistant's booking tool read the same list. */
router.get(
  '/:code/slots',
  validate({ params: projectCodeParamsSchema, query: freeSlotsQuerySchema }),
  async (req, res) => {
    const project = await findActiveProject(req.valid.params.code);
    const slots = await listFreeSlots(project._id, req.valid.query);

    res.json({
      project: {
        code: project.code,
        name: project.name,
        visitDurationMinutes: project.visitDurationMinutes,
      },
      timeZone: IST_TIME_ZONE,
      slots,
    });
  },
);

export default router;

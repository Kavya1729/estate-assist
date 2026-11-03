import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  bookVisit,
  cancelVisit,
  recordVisitOutcome,
  rescheduleVisit,
} from '../services/visitService.js';
import { idParamsSchema } from '../validators/common.js';
import {
  bookVisitSchema,
  rescheduleVisitSchema,
  visitOutcomeSchema,
} from '../validators/visits.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate({ body: bookVisitSchema }), async (req, res) => {
  const visit = await bookVisit({ ...req.valid.body, bookedVia: 'staff', actor: req.user });
  res.status(201).json({ visit });
});

router.post('/:id/cancel', validate({ params: idParamsSchema }), async (req, res) => {
  const visit = await cancelVisit({ visitId: req.valid.params.id, actor: req.user });
  res.json({ visit });
});

router.post(
  '/:id/reschedule',
  validate({ params: idParamsSchema, body: rescheduleVisitSchema }),
  async (req, res) => {
    const visit = await rescheduleVisit({
      visitId: req.valid.params.id,
      slotId: req.valid.body.slotId,
      bookedVia: 'staff',
      actor: req.user,
    });
    res.status(201).json({ visit });
  },
);

router.post(
  '/:id/outcome',
  validate({ params: idParamsSchema, body: visitOutcomeSchema }),
  async (req, res) => {
    const visit = await recordVisitOutcome({
      visitId: req.valid.params.id,
      outcome: req.valid.body.outcome,
      actor: req.user,
    });
    res.json({ visit });
  },
);

export default router;

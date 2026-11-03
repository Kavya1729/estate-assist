import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listReviewQueue, resolveReview } from '../services/staffChatService.js';
import { idParamsSchema } from '../validators/common.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  res.json({ items: await listReviewQueue(req.user) });
});

router.post('/:id/resolve', validate({ params: idParamsSchema }), async (req, res) => {
  const conversation = await resolveReview(req.user, req.valid.params.id);
  res.json({ id: conversation.id, reviewedAt: conversation.reviewedAt });
});

export default router;

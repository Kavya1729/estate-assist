import { Router } from 'express';

import { ROLES } from '../constants/domain.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listExecutives } from '../services/staffService.js';

const router = Router();

router.get('/executives', requireAuth, requireRole(ROLES.SALES_HEAD), async (_req, res) => {
  res.json({ items: await listExecutives() });
});

export default router;

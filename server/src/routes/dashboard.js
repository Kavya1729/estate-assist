import { Router } from 'express';

import { ROLES } from '../constants/domain.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getSourceDashboard } from '../services/dashboardService.js';
import { dashboardQuerySchema } from '../validators/dashboard.js';

const router = Router();

/** Company-wide numbers including marketing spend, so only the sales head sees them. */
router.get(
  '/',
  requireAuth,
  requireRole(ROLES.SALES_HEAD),
  validate({ query: dashboardQuerySchema }),
  async (req, res) => {
    res.json(await getSourceDashboard(req.valid.query));
  },
);

export default router;

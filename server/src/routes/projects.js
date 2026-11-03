import { Router } from 'express';

import { ROLES } from '../constants/domain.js';
import { IST_TIME_ZONE } from '../lib/time.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createSlots,
  listProjects,
  listSchedule,
  updateProject,
} from '../services/projectAdminService.js';
import { findActiveProject, listFreeSlots } from '../services/slotService.js';
import { generateSlotsSchema, updateProjectSchema } from '../validators/projects.js';
import { freeSlotsQuerySchema, projectCodeParamsSchema } from '../validators/slots.js';

const router = Router();
const salesHeadOnly = [requireAuth, requireRole(ROLES.SALES_HEAD)];

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

router.get('/', requireAuth, async (_req, res) => {
  res.json({ items: await listProjects() });
});

/** The fact sheet the assistant answers from. */
router.patch(
  '/:code',
  ...salesHeadOnly,
  validate({ params: projectCodeParamsSchema, body: updateProjectSchema }),
  async (req, res) => {
    res.json({ project: await updateProject(req.valid.params.code, req.valid.body) });
  },
);

/** Staff view of every slot (full and blocked too) with the visits booked in it. */
router.get(
  '/:code/schedule',
  requireAuth,
  validate({ params: projectCodeParamsSchema, query: freeSlotsQuerySchema }),
  async (req, res) => {
    res.json({ items: await listSchedule(req.valid.params.code, req.valid.query) });
  },
);

router.post(
  '/:code/slots',
  ...salesHeadOnly,
  validate({ params: projectCodeParamsSchema, body: generateSlotsSchema }),
  async (req, res) => {
    res.status(201).json(await createSlots(req.valid.params.code, req.valid.body));
  },
);

export default router;

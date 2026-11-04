import { z } from 'zod';

import { formatVisitTime } from '../../lib/time.js';
import { Lead, Project } from '../../models/index.js';
import { listFreeSlots } from '../../services/slotService.js';
import { isoDate } from '../../validators/common.js';

const MAX_OFFERED = 8;

export const getFreeSlots = {
  name: 'get_free_slots',
  description:
    'List real, currently free site-visit slots. Only ever offer times returned by this tool, and pass the slotId to book_visit.',
  schema: z
    .object({
      projectCode: z.string().trim().toUpperCase().max(10).optional(),
      date: isoDate()
        .optional()
        .describe('First day to look at, YYYY-MM-DD in IST. Defaults to today.'),
      days: z
        .number()
        .int()
        .min(1)
        .max(7)
        .optional()
        .describe('How many days to cover (default 3)'),
    })
    .strict(),

  async run({ projectCode, date, days = 3 }, { leadId }) {
    const lead = await Lead.findById(leadId).select('project language').lean();
    const project = projectCode
      ? await Project.findOne({ code: projectCode, isActive: true }).lean()
      : lead.project && (await Project.findOne({ _id: lead.project, isActive: true }).lean());

    if (!project) {
      return {
        ok: false,
        error: projectCode
          ? `No project with code ${projectCode}.`
          : lead.project
            ? 'Site visits for this project are paused. Hand the buyer to a person.'
            : 'The project is not known yet. Ask the buyer which project they want to visit.',
      };
    }

    const slots = await listFreeSlots(project._id, { from: date, days });
    return {
      ok: true,
      project: project.code,
      slots: slots.slice(0, MAX_OFFERED).map((slot) => ({
        slotId: slot.id,
        when: formatVisitTime(slot.startsAt, lead.language),
        seatsLeft: slot.remaining,
      })),
      ...(!slots.length && { note: 'No free slots in this window. Offer to check later dates.' }),
    };
  },
};

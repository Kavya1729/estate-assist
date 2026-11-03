import { z } from 'zod';

import { HttpError } from '../../lib/httpError.js';
import { formatVisitTime } from '../../lib/time.js';
import { Lead, Project } from '../../models/index.js';
import { bookVisit as bookVisitForLead } from '../../services/visitService.js';
import { objectId } from '../../validators/common.js';

export const bookVisit = {
  name: 'book_visit',
  description:
    'Book a site visit in a slot returned by get_free_slots, after the buyer has picked it. If the slot was just taken, offer other free slots.',
  schema: z.object({ slotId: objectId('slotId').describe('slotId from get_free_slots') }).strict(),

  async run({ slotId }, { leadId }) {
    try {
      const visit = await bookVisitForLead({ leadId, slotId, bookedVia: 'assistant' });
      const [lead, project] = await Promise.all([
        Lead.findById(leadId).select('language').lean(),
        Project.findById(visit.project).select('name location').lean(),
      ]);
      return {
        ok: true,
        visitId: visit.id,
        project: project.name,
        when: formatVisitTime(visit.startsAt, lead.language),
        address: [project.location.address, project.location.city].join(', '),
      };
    } catch (err) {
      if (err instanceof HttpError && err.status < 500) {
        return {
          ok: false,
          error: err.message,
          ...(err.details?.reason && { reason: err.details.reason }),
        };
      }
      throw err;
    }
  },
};

import { z } from 'zod';

import { BUYING_TIMELINES } from '../../constants/domain.js';
import { formatRupees } from '../../lib/money.js';
import { Lead, Project } from '../../models/index.js';
import { applyLeadScore } from '../../services/leadScoring.js';

const rupees = z.number().int().min(0).max(100_00_00_000);

export const updateLeadProfile = {
  name: 'update_lead_profile',
  description:
    'Save what the buyer has told you about their needs. Call it as soon as they mention a BHK, budget, timeline, project or their name. Amounts are in rupees (80 lakh = 8000000, 1.2 crore = 12000000).',
  schema: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      projectCode: z.string().trim().toUpperCase().max(10).optional(),
      bhk: z.number().int().min(1).max(6).optional(),
      budgetMin: rupees.optional(),
      budgetMax: rupees.optional(),
      timeline: z
        .enum(BUYING_TIMELINES)
        .optional()
        .describe('When they plan to buy: 0-3m, 3-6m, 6m+ or unknown'),
      notes: z
        .string()
        .trim()
        .max(300)
        .optional()
        .describe('Other preferences, e.g. floor or facing'),
    })
    .strict(),

  async run(input, { leadId }) {
    const lead = await Lead.findById(leadId);
    let project = lead.project ? await Project.findById(lead.project).lean() : null;

    if (input.projectCode) {
      project = await Project.findOne({ code: input.projectCode, isActive: true }).lean();
      if (!project) return { ok: false, error: `No project with code ${input.projectCode}.` };
      lead.project = project._id;
    }
    if (input.name) lead.name = input.name;
    for (const field of ['bhk', 'budgetMin', 'budgetMax', 'timeline', 'notes']) {
      if (input[field] !== undefined) lead.profile[field] = input[field];
    }

    const { budgetMin, budgetMax } = lead.profile;
    if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
      return {
        ok: false,
        error: 'budgetMin is above budgetMax; confirm the budget with the buyer.',
      };
    }

    applyLeadScore(lead, project);
    await lead.save();

    return {
      ok: true,
      saved: {
        project: project?.code ?? null,
        bhk: lead.profile.bhk ?? null,
        budget:
          budgetMax != null
            ? `${budgetMin != null ? `${formatRupees(budgetMin)} – ` : 'up to '}${formatRupees(budgetMax)}`
            : null,
        timeline: lead.profile.timeline,
      },
    };
  },
};

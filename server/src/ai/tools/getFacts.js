import { z } from 'zod';

import { formatRupeeRange } from '../../lib/money.js';
import { IST_TIME_ZONE } from '../../lib/time.js';
import { Lead, Project } from '../../models/index.js';

/** The fact sheet as the model sees it; also the reference for the reply number check. */
export function describeProject(project) {
  return {
    code: project.code,
    name: project.name,
    tagline: project.tagline,
    reraNumber: project.reraNumber,
    location: [project.location.address, project.location.city].join(', '),
    possession: project.possessionDate
      ? new Intl.DateTimeFormat('en-IN', {
          month: 'long',
          year: 'numeric',
          timeZone: IST_TIME_ZONE,
        }).format(project.possessionDate)
      : null,
    configurations: project.configurations.map((c) => ({
      bhk: c.bhk,
      carpetAreaSqft: `${c.carpetAreaSqft.min}–${c.carpetAreaSqft.max} sq ft`,
      priceRange: formatRupeeRange(c.priceRange),
      unitsAvailable: c.unitsAvailable ?? null,
    })),
    facts: project.facts.map((f) => ({ label: f.label, value: f.value })),
  };
}

export const getFacts = {
  name: 'get_facts',
  description:
    "Fetch the sales head's approved fact sheet: prices, sizes, possession, RERA, location, amenities and other facts. The only source you may answer from. Omit projectCode to use the buyer's project, or get both projects if it is not known yet.",
  schema: z
    .object({
      projectCode: z.string().trim().toUpperCase().max(10).optional().describe('e.g. "P1"'),
    })
    .strict(),

  async run({ projectCode }, { leadId }) {
    let filter = { isActive: true };
    if (projectCode) {
      filter = { ...filter, code: projectCode };
    } else {
      const lead = await Lead.findById(leadId).select('project').lean();
      if (lead?.project) filter = { ...filter, _id: lead.project };
    }

    const projects = await Project.find(filter).sort({ code: 1 }).lean();
    if (!projects.length) return { ok: false, error: `No project with code ${projectCode}.` };
    return { ok: true, projects: projects.map(describeProject) };
  },
};

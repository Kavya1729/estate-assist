import { Project } from '../models/index.js';

/**
 * The public face of each active project for the buyer landing page: the
 * registered details only (RERA number, configurations, location, fact sheet).
 */
export async function listCatalog() {
  const projects = await Project.find({ isActive: true }).sort({ code: 1 }).lean();
  return projects.map((p) => ({
    code: p.code,
    name: p.name,
    tagline: p.tagline ?? null,
    reraNumber: p.reraNumber,
    location: {
      address: p.location.address,
      city: p.location.city,
      mapUrl: p.location.mapUrl ?? null,
    },
    possessionDate: p.possessionDate ?? null,
    visitDurationMinutes: p.visitDurationMinutes,
    configurations: p.configurations.map((c) => ({
      bhk: c.bhk,
      carpetAreaSqft: c.carpetAreaSqft,
      priceRange: c.priceRange,
      unitsAvailable: c.unitsAvailable ?? null,
    })),
    facts: p.facts.map((f) => ({ key: f.key, label: f.label, value: f.value })),
  }));
}

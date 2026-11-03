import { DEFAULT_VISIT_TIMES } from '../services/slotService.js';
import { CAMPAIGNS, FIRST_NAMES, LAST_NAMES } from './data/people.js';

const LAKH = 100_000;

const SOURCE_WEIGHTS = { portal: 35, social_ad: 30, website: 15, hoarding_call: 20 };
const STATUS_WEIGHTS = {
  new: 14,
  engaged: 30,
  visit_booked: 18,
  visited: 16,
  no_show: 7,
  lost: 15,
};
const LANGUAGE_WEIGHTS = { en: 70, gu: 20, hi: 10 };
const TIMELINE_WEIGHTS = { '0-3m': 30, '3-6m': 35, '6m+': 20, unknown: 15 };

function budgetFor(random, configuration) {
  const { min, max } = configuration.priceRange;
  const budgetMax =
    Math.round((min + random.next() * (max - min)) / LAKH + random.int(-4, 6)) * LAKH;
  const budgetMin = random.chance(0.6) ? budgetMax - random.int(8, 15) * LAKH : undefined;
  return { budgetMin, budgetMax };
}

function visitFor(random, status) {
  const time = random.pick(DEFAULT_VISIT_TIMES);
  if (status === 'visit_booked') return { inDays: random.int(1, 13), time, bookedVia: 'assistant' };
  return {
    inDays: -random.int(1, 7),
    time,
    outcome: status,
    bookedVia: random.chance(0.7) ? 'assistant' : 'staff',
  };
}

function arrivalFor(random, status, visit) {
  if (visit) return visit.inDays < 0 ? -visit.inDays + random.int(2, 10) : random.int(1, 20);
  if (status === 'new') return random.int(1, 72) / 24;
  if (status === 'lost') return random.int(10, 40);
  return random.int(1, 35) + random.int(0, 23) / 24;
}

function responseFor(random, source, status) {
  if (status === 'new' && random.chance(0.5)) return null;
  if (source === 'hoarding_call') return { minutes: random.int(6, 240) };
  return { seconds: random.int(4, 40) };
}

/**
 * Generated leads that fill the list around the story leads, spread across
 * sources, projects, statuses and languages.
 */
export function generateFillerLeads(random, { count, projects, staff, takenNames, takenPhones }) {
  const leads = [];
  const executivesFor = (code) =>
    staff.filter((s) => s.role === 'sales_executive' && s.projects.includes(code));

  while (leads.length < count) {
    const name = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
    if (takenNames.has(name)) continue;
    takenNames.add(name);

    let phone;
    do phone = `9${random.int(6, 9)}${String(random.int(0, 99_999_999)).padStart(8, '0')}`;
    while (takenPhones.has(phone));
    takenPhones.add(phone);

    const source = random.weighted(SOURCE_WEIGHTS);
    const project = random.pick(projects);
    const configuration = random.pick(project.configurations);
    const status = random.weighted(STATUS_WEIGHTS);
    const visit = ['visit_booked', 'visited', 'no_show'].includes(status)
      ? visitFor(random, status)
      : undefined;
    const knowsBudget = random.chance(0.7);
    const executives = executivesFor(project.code);

    leads.push({
      key: `filler${leads.length + 1}`,
      name,
      phone,
      email:
        source === 'website' && random.chance(0.6)
          ? `${name.toLowerCase().replace(' ', '.')}@example.com`
          : undefined,
      source,
      campaign: random.pick(CAMPAIGNS[source]),
      project: project.code,
      profile: {
        bhk: configuration.bhk,
        ...(knowsBudget && budgetFor(random, configuration)),
        timeline: random.weighted(TIMELINE_WEIGHTS),
      },
      language: random.weighted(LANGUAGE_WEIGHTS),
      consent: random.chance(0.9),
      status: visit ? undefined : status,
      owner: random.chance(0.95) ? random.pick(executives).key : undefined,
      arrived: arrivalFor(random, status, visit),
      response: responseFor(random, source, status),
      chat: source !== 'hoarding_call' && random.chance(0.45) ? 'generic' : undefined,
      visit,
    });
  }
  return leads;
}

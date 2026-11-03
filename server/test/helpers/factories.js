import { ROLES } from '../../src/constants/domain.js';
import { Lead, Project, Slot, User } from '../../src/models/index.js';

export const DEFAULT_PASSWORD = 'Demo@12345';
export const LAKH = 100_000;
export const HOUR = 60 * 60 * 1000;

export function createSlot(project, { startsAt, capacity = 2, ...rest } = {}) {
  const start = startsAt ?? new Date(Date.now() + 48 * HOUR);
  return Slot.create({
    project: project._id,
    startsAt: start,
    endsAt: new Date(start.getTime() + 45 * 60 * 1000),
    capacity,
    ...rest,
  });
}

let phoneSeq = 0;

/** A lead with a unique phone number, attached to the project. */
export function createLead(project, overrides = {}) {
  phoneSeq += 1;
  return Lead.create({
    name: 'Hardik Patel',
    phone: `98${String(10_000_000 + phoneSeq).slice(-8)}`,
    primarySource: 'portal',
    project: project?._id,
    ...overrides,
  });
}

export async function createStaff({
  name = 'Ravi Mehta',
  email = 'ravi@estate.test',
  role = ROLES.SALES_EXECUTIVE,
  password = DEFAULT_PASSWORD,
  isActive = true,
  projects = [],
} = {}) {
  const user = new User({ name, email, role, isActive, projects });
  await user.setPassword(password);
  return user.save();
}

export function createProject({ code = 'P1', name = 'Project 1' } = {}) {
  return Project.create({
    code,
    name,
    reraNumber: `PR/GJ/AHMEDABAD/AUDA/${code}`,
    location: { address: 'SG Highway', city: 'Ahmedabad' },
    configurations: [
      {
        bhk: 2,
        carpetAreaSqft: { min: 680, max: 760 },
        priceRange: { min: 65 * LAKH, max: 82 * LAKH },
      },
      {
        bhk: 3,
        carpetAreaSqft: { min: 980, max: 1150 },
        priceRange: { min: 95 * LAKH, max: 120 * LAKH },
      },
    ],
  });
}

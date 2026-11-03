import { groupBy } from '../lib/collections.js';
import { HttpError } from '../lib/httpError.js';
import { addDays, istDateOf, istDayStart } from '../lib/time.js';
import { Project, Slot, Visit } from '../models/index.js';
import { generateSlots } from './slotService.js';

async function findProject(code) {
  const project = await Project.findOne({ code });
  if (!project) throw new HttpError(404, 'Project not found.');
  return project;
}

export async function listProjects() {
  const projects = await Project.find().sort({ code: 1 });
  return projects.map((p) => p.toJSON());
}

/**
 * The sales head edits the fact sheet. Arrays are replaced as a whole, so the
 * screen always sends the full list of configurations or facts it shows.
 */
export async function updateProject(code, patch) {
  const project = await findProject(code);
  for (const field of [
    'name',
    'tagline',
    'possessionDate',
    'configurations',
    'facts',
    'isActive',
  ]) {
    if (patch[field] !== undefined) project[field] = patch[field];
  }
  await project.save();
  return project.toJSON();
}

/** Every slot in the window, including full and blocked ones, with who is booked. */
export async function listSchedule(code, { from, days = 7 } = {}) {
  const project = await findProject(code);
  const fromDate = from ?? istDateOf(new Date());

  const slots = await Slot.find({
    project: project._id,
    startsAt: { $gte: istDayStart(fromDate), $lt: istDayStart(addDays(fromDate, days)) },
  }).sort({ startsAt: 1 });

  const visits = await Visit.find({
    slot: { $in: slots.map((s) => s._id) },
    status: { $ne: 'cancelled' },
  })
    .populate('lead', 'code name')
    .lean();
  const visitsBySlot = groupBy(visits, (v) => String(v.slot));

  return slots.map((slot) => ({
    ...slot.toJSON(),
    visits: (visitsBySlot.get(String(slot._id)) ?? []).map((v) => ({
      id: String(v._id),
      status: v.status,
      lead: v.lead && { id: String(v.lead._id), code: v.lead.code, name: v.lead.name ?? null },
    })),
  }));
}

export async function createSlots(code, options) {
  const project = await findProject(code);
  const created = await generateSlots(project, options);
  return { created };
}

/**
 * Blocks/unblocks a slot or changes its capacity. Capacity can never drop
 * below the seats already booked; the check and the write are one atomic update.
 */
export async function updateSlot(slotId, { isBlocked, capacity }) {
  const set = {};
  if (isBlocked !== undefined) set.isBlocked = isBlocked;
  if (capacity !== undefined) set.capacity = capacity;

  const filter = { _id: slotId };
  if (capacity !== undefined) filter.bookedCount = { $lte: capacity };

  const slot = await Slot.findOneAndUpdate(filter, { $set: set }, { returnDocument: 'after' });
  if (slot) return slot.toJSON();

  const existing = await Slot.findById(slotId).lean();
  if (!existing) throw new HttpError(404, 'Slot not found.');
  throw new HttpError(
    409,
    `${existing.bookedCount} visits are already booked in this slot; capacity cannot be lower.`,
  );
}

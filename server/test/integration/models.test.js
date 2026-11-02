import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
  Conversation,
  Counter,
  Lead,
  Outbox,
  Project,
  Slot,
  Visit,
} from '../../src/models/index.js';
import { useTestDatabase } from '../helpers/db.js';

useTestDatabase();

const HOUR = 60 * 60 * 1000;

async function createProject() {
  return Project.create({
    code: 'p1',
    name: 'Project 1',
    reraNumber: 'PR/GJ/AHMEDABAD/AUDA/0001',
    location: { address: 'SG Highway', city: 'Ahmedabad' },
  });
}

async function createSlot(project, startsAt = new Date(Date.now() + 24 * HOUR)) {
  return Slot.create({
    project: project.id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + HOUR),
  });
}

describe('Lead', () => {
  it('stores the normalised phone and blocks the same number in another format', async () => {
    const lead = await Lead.create({
      name: 'Hardik Patel',
      phone: '+91 98250-12345',
      primarySource: 'portal',
    });

    expect(lead.normalizedPhone).toBe('9825012345');
    await expect(
      Lead.create({ name: 'Hardik', phone: '09825012345', primarySource: 'social_ad' }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('allows many leads without a phone (anonymous web chats)', async () => {
    await Lead.create({ primarySource: 'website' });
    await expect(Lead.create({ primarySource: 'website' })).resolves.toBeDefined();
  });

  it('rejects an invalid mobile number', async () => {
    await expect(Lead.create({ phone: '12345', primarySource: 'website' })).rejects.toThrow(
      /valid 10-digit Indian mobile/,
    );
  });

  it('assigns sequential codes and skips none when a save fails', async () => {
    await Lead.create({ phone: 'bad', primarySource: 'website' }).catch(() => {});
    const first = await Lead.create({ primarySource: 'website' });
    const second = await Lead.create({ primarySource: 'portal' });

    expect(first.code).toBe('LD-58201');
    expect(second.code).toBe('LD-58202');
    expect((await Counter.findById('lead')).seq).toBe(2);
  });

  it('never hands out the same code to concurrent saves', async () => {
    const leads = await Promise.all(
      Array.from({ length: 15 }, () => Lead.create({ primarySource: 'website' })),
    );

    expect(new Set(leads.map((l) => l.code)).size).toBe(15);
  });
});

describe('Slot', () => {
  it('cannot be created twice for the same project and time', async () => {
    const project = await createProject();
    const slot = await createSlot(project);

    await expect(createSlot(project, slot.startsAt)).rejects.toMatchObject({ code: 11000 });
  });

  it('exposes remaining capacity', async () => {
    const slot = await createSlot(await createProject());

    expect(slot.toJSON().remaining).toBe(2);
  });
});

describe('Visit', () => {
  it('allows only one booked visit per lead, but a new one after cancelling', async () => {
    const project = await createProject();
    const slot = await createSlot(project);
    const lead = await Lead.create({ primarySource: 'portal' });
    const visit = { lead: lead.id, slot: slot.id, project: project.id, startsAt: slot.startsAt };

    const first = await Visit.create({ ...visit, bookedVia: 'assistant' });
    await expect(Visit.create({ ...visit, bookedVia: 'staff' })).rejects.toMatchObject({
      code: 11000,
    });

    first.status = 'cancelled';
    await first.save();
    await expect(Visit.create({ ...visit, bookedVia: 'staff' })).resolves.toBeDefined();
  });
});

describe('Outbox', () => {
  it('records each reminder only once per visit', async () => {
    const message = {
      lead: new mongoose.Types.ObjectId(),
      template: 'reminder_24h',
      to: '9825012345',
      body: 'Your site visit is tomorrow at 11:00.',
      dedupeKey: 'reminder_24h:visit-1',
    };

    await Outbox.create(message);
    await expect(Outbox.create(message)).rejects.toMatchObject({ code: 11000 });
  });
});

describe('Conversation', () => {
  it('serialises nested messages with `id`, like top-level documents', () => {
    const conversation = new Conversation({
      lead: new mongoose.Types.ObjectId(),
      messages: [{ role: 'buyer', text: 'Is a 3 BHK available in Project 1?' }],
    });

    const [message] = conversation.toJSON().messages;

    expect(message.id).toEqual(expect.any(String));
    expect(message).not.toHaveProperty('_id');
  });
});

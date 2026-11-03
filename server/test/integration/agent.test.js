import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_TOOL_CALLS_PER_TURN } from '../../src/ai/agent.js';
import { createMockProvider } from '../../src/ai/providers/mockProvider.js';
import { Conversation, Lead, Outbox, Slot, Visit } from '../../src/models/index.js';
import { handleBuyerMessage } from '../../src/services/conversationService.js';
import { useTestDatabase } from '../helpers/db.js';
import { LAKH, createLead, createProject, createSlot, createStaff } from '../helpers/factories.js';

useTestDatabase();

let project;
let executive;
let lead;

beforeEach(async () => {
  project = await createProject();
  await project.updateOne({
    facts: [{ key: 'clubhouse', label: 'Clubhouse', value: 'Clubhouse with gym and pool' }],
  });
  executive = await createStaff({ name: 'Ravi Mehta', projects: [project._id] });
  lead = await createLead(project, { name: 'Nidhi Shah', assignedTo: executive._id });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const call = (name, args = {}, id = `c_${name}`) => ({
  toolCalls: [{ id, name, arguments: JSON.stringify(args) }],
});
const say = (content) => ({ content });
const lastToolResult = (messages) => JSON.parse(messages.at(-1).content);

function chat(text, script) {
  const provider = createMockProvider({ script });
  return handleBuyerMessage({ leadId: lead._id, text, provider }).then((r) => ({ ...r, provider }));
}

describe('agent turn', () => {
  it('replies in text and records the first response', async () => {
    const { reply, mode } = await chat('Hi', [say('Hello! How can I help?')]);

    expect(mode).toBe('ai');
    expect(reply.text).toBe('Hello! How can I help?');
    const stored = await Lead.findById(lead._id);
    expect(stored.status).toBe('engaged');
    expect(stored.firstResponseAt).toBeInstanceOf(Date);

    const conversation = await Conversation.findOne({ lead: lead._id });
    expect(conversation.messages.map((m) => m.role)).toEqual(['assistant', 'buyer', 'assistant']);
  });

  it('answers from the fact sheet via get_facts and stores the tool call', async () => {
    let factsSeen;
    const { reply } = await chat('Is there a clubhouse? What does a 3 BHK cost?', [
      call('get_facts'),
      (messages) => {
        factsSeen = lastToolResult(messages);
        return say('Yes, with a gym and pool. 3 BHK is ₹95 lakh – ₹1.2 crore.');
      },
    ]);

    const [p1] = factsSeen.projects;
    expect(p1.facts).toEqual([{ label: 'Clubhouse', value: 'Clubhouse with gym and pool' }]);
    expect(p1.configurations.find((c) => c.bhk === 3).priceRange).toBe('₹95 lakh – ₹1.2 crore');
    expect(reply.toolCalls).toEqual([expect.objectContaining({ name: 'get_facts', ok: true })]);
  });

  it('saves what the buyer says and rescores the lead', async () => {
    await chat('Looking for 3 BHK around 1.1 crore, within 2 months', [
      call('update_lead_profile', { bhk: 3, budgetMax: 110 * LAKH, timeline: '0-3m' }),
      say('Noted!'),
    ]);

    const stored = await Lead.findById(lead._id);
    expect(stored.profile).toMatchObject({ bhk: 3, budgetMax: 110 * LAKH, timeline: '0-3m' });
    expect(stored.score).toBe(50);
    expect(stored.scoreReasons).toEqual([
      'Budget fits the project',
      'Plans to buy within 3 months',
    ]);
  });

  it('books a real free slot through get_free_slots and book_visit', async () => {
    const slot = await createSlot(project);
    let offered;

    const { reply } = await chat('Can I visit this weekend?', [
      call('get_free_slots', { days: 7 }),
      (messages) => {
        offered = lastToolResult(messages);
        return call('book_visit', { slotId: offered.slots[0].slotId });
      },
      (messages) => say(`Booked for ${lastToolResult(messages).when}`),
    ]);

    expect(offered.slots).toEqual([
      expect.objectContaining({ slotId: slot.id, seatsLeft: 2, when: expect.any(String) }),
    ]);
    expect(reply.text).toMatch(/^Booked for /);
    expect(
      await Visit.countDocuments({ lead: lead._id, status: 'booked', bookedVia: 'assistant' }),
    ).toBe(1);
    expect((await Slot.findById(slot._id)).bookedCount).toBe(1);
    expect((await Lead.findById(lead._id)).status).toBe('visit_booked');
  });

  it('tells the model when the slot was just taken instead of pretending', async () => {
    const full = await createSlot(project, { capacity: 1, bookedCount: 1 });
    let bookingResult;

    await chat('Book it', [
      call('book_visit', { slotId: full.id }),
      (messages) => {
        bookingResult = lastToolResult(messages);
        return say('Sorry, that slot just filled up.');
      },
    ]);

    expect(bookingResult).toMatchObject({ ok: false, reason: 'slot_full' });
    expect(await Visit.countDocuments()).toBe(0);
  });

  it('feeds invalid tool arguments back so the model can correct itself', async () => {
    const slot = await createSlot(project);
    let validationResult;

    const { reply } = await chat('Book the 11am one', [
      call('book_visit', { slotId: 'Saturday 11am' }, 'bad'),
      (messages) => {
        validationResult = lastToolResult(messages);
        return call('book_visit', { slotId: slot.id }, 'good');
      },
      say('Booked!'),
    ]);

    expect(validationResult).toMatchObject({ ok: false, error: 'Invalid arguments' });
    expect(reply.toolCalls.map((t) => t.ok)).toEqual([false, true]);
    expect(await Visit.countDocuments()).toBe(1);
  });

  it('hands off when the model asks for a person', async () => {
    const { reply, mode } = await chat('Which banks give home loans for this project?', [
      call('handoff_to_human', {
        reason: 'missing_fact',
        summary: { needs: '3 BHK in Project 1', questions: ['Loan options'] },
      }),
      (messages) => say(`${lastToolResult(messages).executive} will call you shortly.`),
    ]);

    expect(mode).toBe('human');
    expect(reply.text).toBe('Ravi Mehta will call you shortly.');
    const stored = await Lead.findById(lead._id);
    expect(stored.handoff.reason).toBe('missing_fact');
    expect(stored.handoff.summary.questions).toEqual(['Loan options']);
    expect(stored.handoff.summary.source).toBe('assistant');
    expect(await Outbox.countDocuments({ template: 'handoff_notice' })).toBe(1);
  });
});

describe('after a handoff', () => {
  it('refuses further tool calls in the same turn', async () => {
    const slot = await createSlot(project);
    let refusal;

    await chat('Is the loan approval done by you? Also book Saturday', [
      call('handoff_to_human', { reason: 'missing_fact', summary: { needs: 'Loan approval' } }),
      call('book_visit', { slotId: slot.id }),
      (messages) => {
        refusal = lastToolResult(messages);
        return say('Ravi will call you about the loan and the visit.');
      },
    ]);

    expect(refusal).toMatchObject({ ok: false, error: expect.stringMatching(/handed to a sales/) });
    expect(await Visit.countDocuments()).toBe(0);
  });
});

describe('limits and fallbacks', () => {
  it(`forces a handoff after ${MAX_TOOL_CALLS_PER_TURN} tool calls in one turn`, async () => {
    const script = Array.from({ length: MAX_TOOL_CALLS_PER_TURN + 1 }, (_, i) =>
      call('get_facts', {}, `loop_${i}`),
    );

    const { reply, mode, forcedHandoff } = await chat('Tell me everything', script);

    expect(forcedHandoff).toBe('tool_limit');
    expect(mode).toBe('human');
    expect(reply.text).toContain('Ravi Mehta');
    expect(reply.toolCalls).toHaveLength(MAX_TOOL_CALLS_PER_TURN);
    expect((await Lead.findById(lead._id)).handoff.reason).toBe('tool_limit');
  });

  it('falls back to a person when the provider fails', async () => {
    const { reply, forcedHandoff, mode } = await chat('Hello?', [new Error('Groq is down')]);

    expect(forcedHandoff).toBe('assistant_error');
    expect(mode).toBe('human');
    expect(reply.text).toMatch(/Ravi Mehta/);
  });

  it('falls back when the model returns an empty answer', async () => {
    const { forcedHandoff } = await chat('Hello?', [say('   ')]);
    expect(forcedHandoff).toBe('assistant_error');
  });

  it('replies in the buyer’s language when falling back', async () => {
    await Lead.updateOne({ _id: lead._id }, { $set: { language: 'gu' } });
    const { reply } = await chat('નમસ્તે', [new Error('down')]);
    expect(reply.text).toContain('Ravi Mehta');
    expect(reply.text).toContain('કોલ');
  });

  it('stays quiet once a person has taken over', async () => {
    await chat('Call me', [new Error('down')]);
    const provider = createMockProvider({ script: [] });

    const result = await handleBuyerMessage({ leadId: lead._id, text: 'Hello?', provider });

    expect(result).toMatchObject({ mode: 'human', reply: null });
    expect(provider.calls).toHaveLength(0);
    const conversation = await Conversation.findOne({ lead: lead._id });
    expect(conversation.messages.at(-1)).toMatchObject({ role: 'buyer', text: 'Hello?' });
  });
});

describe('conversation memory', () => {
  it('replays earlier tool calls so the model can refer back to them', async () => {
    const slot = await createSlot(project);
    await chat('Free slots?', [call('get_free_slots'), say('Saturday 11am is free.')]);

    const { provider } = await chat('Book that one', [say('Sure')]);

    const sent = provider.calls[0];
    expect(sent[0].role).toBe('system');
    const toolMessage = sent.find((m) => m.role === 'tool');
    expect(JSON.parse(toolMessage.content).slots[0].slotId).toBe(slot.id);
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'Book that one' });
  });

  it('puts what we know about the buyer in the system prompt, but not the facts', async () => {
    await Lead.updateOne({ _id: lead._id }, { $set: { 'profile.bhk': 2 } });

    const { provider } = await chat('Hi', [say('Hello')]);

    const system = provider.calls[0][0].content;
    expect(system).toContain('Name: Nidhi Shah');
    expect(system).toContain('BHK: 2');
    expect(system).toContain('Project 1 (P1)');
    expect(system).not.toContain('gym and pool');
  });
});

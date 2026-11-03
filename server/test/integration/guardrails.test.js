import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockProvider } from '../../src/ai/providers/mockProvider.js';
import { Conversation, Lead } from '../../src/models/index.js';
import { handleBuyerMessage } from '../../src/services/conversationService.js';
import { useTestDatabase } from '../helpers/db.js';
import { createLead, createProject, createStaff } from '../helpers/factories.js';

useTestDatabase();

let lead;

beforeEach(async () => {
  const project = await createProject();
  const executive = await createStaff({ name: 'Ravi Mehta', projects: [project._id] });
  lead = await createLead(project, { name: 'Kavita Joshi', assignedTo: executive._id });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const call = (name, args = {}) => ({
  toolCalls: [{ id: `c_${name}`, name, arguments: JSON.stringify(args) }],
});
const say = (content) => ({ content });

async function send(text, script = []) {
  const provider = createMockProvider({ script });
  const result = await handleBuyerMessage({ leadId: lead._id, text, provider });
  return { ...result, provider };
}

const stored = () => Lead.findById(lead._id);
const conversation = () => Conversation.findOne({ lead: lead._id });

describe('pre-checks', () => {
  it('hands a discount request to the executive without asking the model', async () => {
    const summary = {
      needs: '3 BHK in Project 1',
      budget: null,
      questions: ['Is there a discount?'],
      concerns: [],
    };
    const { reply, mode, guardrail, provider } = await send('Is there any discount on 3 BHK?', [
      summary,
    ]);

    expect(guardrail).toBe('pre_check:price_or_discount');
    expect(mode).toBe('human');
    expect(reply.text).toMatch(/Pricing and offers .* Ravi Mehta/);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0][0].content).toMatch(/handoff notes/);

    const { handoff } = await stored();
    expect(handoff.reason).toBe('price_or_discount');
    expect(handoff.summary).toMatchObject({ ...summary, budget: null, source: 'model' });
  });

  it('falls back to the rule-based summary when the JSON is unusable', async () => {
    await send('Can I talk to a person?', [{ needs: '' }]);

    const { handoff } = await stored();
    expect(handoff.reason).toBe('buyer_requested');
    expect(handoff.summary.source).toBe('rules');
    expect(handoff.summary.questions).toEqual(['Can I talk to a person?']);
  });

  it('opts a buyer out on STOP and blocks the assistant until START', async () => {
    const stop = await send('STOP');
    expect(stop.guardrail).toBe('opt_out');
    expect(stop.reply.text).toMatch(/not receive any more messages/);
    expect((await stored()).optedOut).toBe(true);

    const blocked = await send('What is the price?', [say('should not be used')]);
    expect(blocked.guardrail).toBe('blocked');
    expect(blocked.provider.calls).toHaveLength(0);

    const start = await send('START');
    expect(start.guardrail).toBe('opt_in');
    expect((await stored()).optedOut).toBe(false);
  });
});

describe('language detection', () => {
  it('switches the lead to the script the buyer writes in and replies in it', async () => {
    const { reply } = await send('मुझे किसी इंसान से बात करनी है', [new Error('no JSON')]);

    expect((await stored()).language).toBe('hi');
    expect(reply.text).toContain('Ravi Mehta');
    expect(reply.text).toContain('कॉल');
  });

  it('keeps the saved language for a message without letters', async () => {
    await Lead.updateOne({ _id: lead._id }, { $set: { language: 'gu' } });
    await send('3', [say('OK')]);
    expect((await stored()).language).toBe('gu');
  });
});

describe('post-check on numbers', () => {
  it('blocks a reply with an invented price, sends safe text and flags the chat', async () => {
    const { reply, guardrail, mode } = await send('How much is a 3 BHK?', [
      call('get_facts'),
      say('A 3 BHK starts at just ₹89 lakh!'),
    ]);

    expect(guardrail).toBe('unverified_numbers');
    expect(mode).toBe('ai');
    expect(reply.text).toMatch(/^I want to be sure I give you accurate details/);

    const chat = await conversation();
    expect(chat.flagged).toBe(true);
    const last = chat.messages.at(-1);
    expect(last).toMatchObject({
      flagged: true,
      flagReason: 'Unverified numbers: 89 lakh',
      blockedText: 'A 3 BHK starts at just ₹89 lakh!',
    });
  });

  it('lets a reply through when its numbers come from the fact sheet', async () => {
    const { reply, guardrail } = await send('How much is a 3 BHK?', [
      call('get_facts'),
      say('A 3 BHK is ₹95 lakh – ₹1.2 crore.'),
    ]);

    expect(guardrail).toBeNull();
    expect(reply.text).toBe('A 3 BHK is ₹95 lakh – ₹1.2 crore.');
    expect((await conversation()).flagged).toBe(false);
  });
});

describe('provider failure', () => {
  it('sends the fallback, hands off and summarises by rules without calling the provider again', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    const { reply, forcedHandoff, mode, provider } = await send('Is parking included?', [timeout]);

    expect(forcedHandoff).toBe('assistant_error');
    expect(mode).toBe('human');
    expect(reply.text).toContain('Ravi Mehta');
    expect(provider.calls).toHaveLength(1);

    const { handoff } = await stored();
    expect(handoff).toMatchObject({ reason: 'assistant_error' });
    expect(handoff.summary).toMatchObject({
      source: 'rules',
      questions: ['Is parking included?'],
      concerns: ['Is parking included?'],
    });
  });
});

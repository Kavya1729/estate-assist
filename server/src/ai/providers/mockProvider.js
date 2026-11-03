import { LLMError } from './llmProvider.js';

/**
 * Two uses:
 * - `script`: tests queue exact responses (or functions of the messages) to
 *   drive the agent loop deterministically.
 * - No script: a keyword-based stand-in for the demo without a Groq key. It is
 *   not meant to be clever, only to exercise every tool end to end.
 *
 * @returns {import('./llmProvider.js').LLMProvider & { calls: object[][] }}
 */
export function createMockProvider({ script } = {}) {
  const queue = script ? [...script] : null;
  const calls = [];
  let nextId = 0;

  const toolCall = (name, args = {}) => ({
    content: null,
    toolCalls: [{ id: `mock_${(nextId += 1)}`, name, arguments: JSON.stringify(args) }],
  });

  return {
    name: 'mock',
    calls,
    async complete({ messages }) {
      calls.push(messages);
      if (!queue) return demoResponse(messages, toolCall);

      const step = queue.shift();
      if (step === undefined) throw new LLMError('Mock script exhausted');
      if (step instanceof Error) throw step;
      const response = typeof step === 'function' ? step(messages) : step;
      return { content: null, toolCalls: [], ...response };
    },

    /** Scripted steps are returned as the parsed JSON; the demo has no JSON mode (rules take over). */
    async completeJSON({ messages }) {
      calls.push(messages);
      if (!queue) throw new LLMError('The demo provider has no JSON mode');

      const step = queue.shift();
      if (step === undefined) throw new LLMError('Mock script exhausted');
      if (step instanceof Error) throw step;
      return typeof step === 'function' ? step(messages) : step;
    },
  };
}

const PATTERNS = {
  human: /\b(human|person|agent|executive|someone|call me|talk to|baat)\b/i,
  discount: /\b(discount|offer|negotiat|best price|deal)\b/i,
  pick: /^\s*(?:book\s*)?(?:slot\s*)?#?([1-8])\s*$/i,
  visit: /\b(visit|slot|book|available|appointment|schedule|kab)\b/i,
  bhk: /\b([1-6])\s*bhk\b/i,
  budget: /(\d+(?:\.\d+)?)\s*(lakh|lac|l|cr|crore)\b/i,
  facts:
    /\b(price|cost|rate|kitn|amenit|possession|rera|location|where|size|carpet|bhk|project|parking|loan)/i,
};

function lastToolResult(messages, name) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'tool') continue;
    const call = messages
      .slice(0, i)
      .reverse()
      .flatMap((m) => m.tool_calls ?? [])
      .find((c) => c.id === message.tool_call_id);
    if (call?.function?.name === name) return JSON.parse(message.content);
  }
  return null;
}

function replyToTool(messages) {
  const resultMessage = messages.at(-1);
  const call = messages
    .flatMap((m) => m.tool_calls ?? [])
    .find((c) => c.id === resultMessage.tool_call_id);
  const result = JSON.parse(resultMessage.content);

  if (result.error) return `Sorry, ${result.error}`;

  switch (call?.function?.name) {
    case 'get_facts': {
      const [project] = result.projects;
      const prices = project.configurations
        .map((c) => `${c.bhk} BHK at ${c.priceRange}`)
        .join(', ');
      return `${project.name} has ${prices}. Would you like to book a site visit?`;
    }
    case 'update_lead_profile':
      return 'Noted, thank you. Shall I show you free site-visit slots?';
    case 'get_free_slots':
      if (!result.slots.length)
        return 'There are no free slots in those days. Shall I check later dates?';
      return `Free slots: ${result.slots
        .slice(0, 3)
        .map((s, i) => `${i + 1}) ${s.when}`)
        .join(', ')}. Reply with a number to book.`;
    case 'book_visit':
      return `Done! Your site visit is booked for ${result.when}. You will get a WhatsApp confirmation.`;
    case 'handoff_to_human':
      return result.executive
        ? `${result.executive} from our sales team will call you shortly.`
        : 'Our sales team will call you shortly.';
    default:
      return 'How else can I help?';
  }
}

function demoResponse(messages, toolCall) {
  const last = messages.at(-1);
  if (last.role === 'tool') return { content: replyToTool(messages), toolCalls: [] };

  const text = last.content ?? '';
  if (PATTERNS.human.test(text)) {
    return toolCall('handoff_to_human', { reason: 'buyer_requested', summary: { needs: text } });
  }
  if (PATTERNS.discount.test(text)) {
    return toolCall('handoff_to_human', { reason: 'price_or_discount', summary: { needs: text } });
  }

  const pick = text.match(PATTERNS.pick);
  const offered = pick && lastToolResult(messages, 'get_free_slots');
  if (offered?.slots?.[pick[1] - 1]) {
    return toolCall('book_visit', { slotId: offered.slots[pick[1] - 1].slotId });
  }
  if (PATTERNS.visit.test(text)) return toolCall('get_free_slots', {});

  const bhk = text.match(PATTERNS.bhk);
  const budget = text.match(PATTERNS.budget);
  if (budget) {
    const unit = /^c/i.test(budget[2]) ? 10_000_000 : 100_000;
    return toolCall('update_lead_profile', {
      ...(bhk && { bhk: Number(bhk[1]) }),
      budgetMax: Math.round(Number(budget[1]) * unit),
    });
  }
  if (PATTERNS.facts.test(text)) return toolCall('get_facts', {});

  return {
    content:
      'Hi! I can share prices, sizes, amenities and possession dates, and book a site visit for you. What are you looking for?',
    toolCalls: [],
  };
}

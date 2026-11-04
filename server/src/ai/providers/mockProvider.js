import { answerFromProject } from '../factSearch.js';
import { LLMError } from './llmProvider.js';

/**
 * Two uses:
 * - `script`: tests queue exact responses (or functions of the messages) to
 *   drive the agent loop deterministically.
 * - No script: a rule-based stand-in for the demo without a Groq key. It uses
 *   the same tools and rules as the model: answers come only from get_facts
 *   (matched with factSearch), and anything the fact sheet does not cover is
 *   handed to a sales executive with reason missing_fact.
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
  bookingQuestion: /how (to|do i|can i) (book|buy)|booking (process|amount)/i,
  visit: /\b(site visit|visit|slots?|appointment|schedule)\b|\bbook\b/i,
  bhk: /\b([1-6])\s*bhk\b/i,
  budget: /(\d+(?:\.\d+)?)\s*(lakh|lac|l|cr|crore)\b/i,
  project: /\b(?:project\s*|p)([12])\b/i,
  greeting:
    /^(hi+|hello|hey|hii+|namaste|namaskar|kem cho|good (morning|afternoon|evening)|नमस्ते|नमस्कार|નમસ્તે|કેમ છો)\b/iu,
  thanks:
    /^((thanks?|thank you|ty|ok(ay)?|k|hmm+|cool|great|nice|fine|got it|sure|alright|not now|so much|a lot|ji|sir|madam|dhanyavad|shukriya|aabhar|धन्यवाद|शुक्रिया|ठीक है|આભાર|ઠીક છે)[\s,!.]*){1,4}$/iu,
};

const SMALL_TALK_MAX_WORDS = 4;

/** The demo's own sentences in the buyer's language; fact values stay as the sales head wrote them. */
const COPY = {
  en: {
    greeting:
      'Hi! I can help with prices, sizes, amenities, specifications, location and site visits for our projects. What would you like to know?',
    thanks:
      'You are welcome! Ask me anything about the homes, or tap the calendar to book a site visit.',
    closing: 'Would you like to book a site visit to see it?',
    team: (executive) => (executive ? `${executive} from our sales team` : 'Our sales executive'),
    missingFact: (who) =>
      `I don't have confirmed details on that. ${who} will connect with you shortly.`,
    requested: (who) => `${who} will call you shortly.`,
    discount: (who) =>
      `Prices and offers are confirmed by our sales team. ${who} will connect with you shortly.`,
  },
  hi: {
    greeting:
      'नमस्ते! मैं हमारे प्रोजेक्ट्स की कीमत, साइज़, सुविधाएँ, स्पेसिफिकेशन, लोकेशन और साइट विज़िट के बारे में मदद कर सकता हूँ। आप क्या जानना चाहेंगे?',
    thanks: 'धन्यवाद! घरों के बारे में कुछ भी पूछिए, या साइट विज़िट बुक कीजिए।',
    closing: 'क्या आप इसे देखने के लिए साइट विज़िट बुक करना चाहेंगे?',
    team: (executive) =>
      executive ? `हमारी सेल्स टीम से ${executive}` : 'हमारे सेल्स एग्जीक्यूटिव',
    missingFact: (who) => `इसकी पक्की जानकारी मेरे पास नहीं है। ${who} जल्द ही आपसे संपर्क करेंगे।`,
    requested: (who) => `${who} जल्द ही आपको कॉल करेंगे।`,
    discount: (who) =>
      `कीमत और ऑफ़र हमारी सेल्स टीम ही तय करती है। ${who} जल्द ही आपसे संपर्क करेंगे।`,
  },
  gu: {
    greeting:
      'નમસ્તે! હું અમારા પ્રોજેક્ટ્સની કિંમત, સાઇઝ, સુવિધાઓ, સ્પેસિફિકેશન, લોકેશન અને સાઇટ વિઝિટ વિશે મદદ કરી શકું છું. તમે શું જાણવા માંગો છો?',
    thanks: 'આભાર! ઘરો વિશે કંઈ પણ પૂછો, અથવા સાઇટ વિઝિટ બુક કરો.',
    closing: 'શું તમે તે જોવા માટે સાઇટ વિઝિટ બુક કરવા માંગો છો?',
    team: (executive) =>
      executive ? `અમારી સેલ્સ ટીમમાંથી ${executive}` : 'અમારા સેલ્સ એક્ઝિક્યુટિવ',
    missingFact: (who) => `આની પાકી માહિતી મારી પાસે નથી. ${who} ટૂંક સમયમાં તમારો સંપર્ક કરશે.`,
    requested: (who) => `${who} ટૂંક સમયમાં તમને કૉલ કરશે.`,
    discount: (who) =>
      `કિંમત અને ઓફર અમારી સેલ્સ ટીમ જ નક્કી કરે છે. ${who} ટૂંક સમયમાં તમારો સંપર્ક કરશે.`,
  },
};

const lastBuyerText = (messages) => messages.findLast((m) => m.role === 'user')?.content ?? '';

/** The script the buyer writes in wins; otherwise the saved preference from the system prompt. */
function languageOf(messages) {
  const text = lastBuyerText(messages);
  if (/[\u0A80-\u0AFF]/u.test(text)) return 'gu';
  if (/[\u0900-\u097F]/u.test(text)) return 'hi';
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const saved = system.match(/saved preference is (English|Hindi|Gujarati)/)?.[1];
  return { Hindi: 'hi', Gujarati: 'gu' }[saved] ?? 'en';
}

const isSmallTalk = (text, pattern) =>
  pattern.test(text.trim()) && text.trim().split(/\s+/).length <= SMALL_TALK_MAX_WORDS;

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

/** Fact-sheet answer for each project, or a handoff when the sheet does not cover the question. */
function answerFacts(messages, result, toolCall) {
  const question = lastBuyerText(messages);
  const answers = result.projects
    .map((project) => ({ project, parts: answerFromProject(question, project) }))
    .filter(({ parts }) => parts.length)
    .map(({ project, parts }) => `${project.name}: ${parts.join(' ')}`);

  if (!answers.length) {
    return toolCall('handoff_to_human', {
      reason: 'missing_fact',
      summary: { needs: question.slice(0, 500), questions: [question.slice(0, 300)] },
    });
  }
  const copy = COPY[languageOf(messages)];
  return { content: [...answers, copy.closing].join('\n'), toolCalls: [] };
}

function handoffReply(messages, call, result) {
  const copy = COPY[languageOf(messages)];
  const who = copy.team(result.executive);
  const { reason } = JSON.parse(call.function.arguments || '{}');
  if (reason === 'missing_fact') return copy.missingFact(who);
  if (reason === 'price_or_discount') return copy.discount(who);
  return copy.requested(who);
}

function replyToTool(messages, toolCall) {
  const resultMessage = messages.at(-1);
  const call = messages
    .flatMap((m) => m.tool_calls ?? [])
    .find((c) => c.id === resultMessage.tool_call_id);
  const result = JSON.parse(resultMessage.content);

  if (result.error) return { content: `Sorry, ${result.error}`, toolCalls: [] };

  const text = (content) => ({ content, toolCalls: [] });
  switch (call?.function?.name) {
    case 'get_facts':
      return answerFacts(messages, result, toolCall);
    case 'update_lead_profile':
      return text('Noted, thank you. Shall I show you free site-visit slots?');
    case 'get_free_slots':
      if (!result.slots.length)
        return text('There are no free slots in those days. Shall I check later dates?');
      return text(
        `Free slots: ${result.slots
          .slice(0, 3)
          .map((s, i) => `${i + 1}) ${s.when}`)
          .join(', ')}. Reply with a number to book.`,
      );
    case 'book_visit':
      return text(
        `Done! Your site visit is booked for ${result.when}. You will get a WhatsApp confirmation.`,
      );
    case 'handoff_to_human':
      return text(handoffReply(messages, call, result));
    default:
      return text('How else can I help?');
  }
}

function demoResponse(messages, toolCall) {
  const last = messages.at(-1);
  if (last.role === 'tool') return replyToTool(messages, toolCall);

  const text = last.content ?? '';
  const copy = COPY[languageOf(messages)];
  if (PATTERNS.human.test(text)) {
    return toolCall('handoff_to_human', { reason: 'buyer_requested', summary: { needs: text } });
  }
  if (PATTERNS.discount.test(text)) {
    return toolCall('handoff_to_human', { reason: 'price_or_discount', summary: { needs: text } });
  }
  if (isSmallTalk(text, PATTERNS.greeting)) return { content: copy.greeting, toolCalls: [] };
  if (isSmallTalk(text, PATTERNS.thanks)) return { content: copy.thanks, toolCalls: [] };

  const pick = text.match(PATTERNS.pick);
  const offered = pick && lastToolResult(messages, 'get_free_slots');
  if (offered?.slots?.[pick[1] - 1]) {
    return toolCall('book_visit', { slotId: offered.slots[pick[1] - 1].slotId });
  }
  if (!PATTERNS.bookingQuestion.test(text) && PATTERNS.visit.test(text)) {
    return toolCall('get_free_slots', {});
  }

  const bhk = text.match(PATTERNS.bhk);
  const budget = text.match(PATTERNS.budget);
  if (budget) {
    const unit = /^c/i.test(budget[2]) ? 10_000_000 : 100_000;
    return toolCall('update_lead_profile', {
      ...(bhk && { bhk: Number(bhk[1]) }),
      budgetMax: Math.round(Number(budget[1]) * unit),
    });
  }

  // Every other message is a question for the fact sheet; no match there means a handoff.
  const project = text.match(PATTERNS.project);
  return toolCall('get_facts', project ? { projectCode: `P${project[1]}` } : {});
}

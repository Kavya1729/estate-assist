import { LLMError } from './llmProvider.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_ATTEMPTS = 2;
const MAX_RETRY_DELAY_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(response, attempt) {
  const header = Number(response?.headers?.get('retry-after'));
  const requested = Number.isFinite(header) && header > 0 ? header * 1000 : 800 * attempt;
  return Math.min(requested, MAX_RETRY_DELAY_MS);
}

async function errorFrom(response) {
  let error = {};
  try {
    error = (await response.json())?.error ?? {};
  } catch {
    // Body was not JSON; the status code is enough.
  }
  const detail = error.message ?? '';
  // Llama occasionally emits a malformed tool call; a fresh sample usually succeeds.
  const retryable =
    response.status === 429 || response.status >= 500 || error.code === 'tool_use_failed';
  return new LLMError(`Groq returned ${response.status}${detail ? `: ${detail}` : ''}`, {
    status: response.status,
    retryable,
  });
}

/** Headroom for GPT-OSS's hidden reasoning at low effort. */
const REASONING_TOKENS = 400;

/**
 * Reasoning models (GPT-OSS) spend completion tokens on hidden reasoning before
 * the reply, so they get a low effort setting and some extra budget. Groq counts
 * max_completion_tokens against the per-minute token limit, so the budget stays tight.
 */
function generationOptions(model, replyTokens) {
  if (!model.startsWith('openai/gpt-oss')) return { max_completion_tokens: replyTokens };
  return { reasoning_effort: 'low', max_completion_tokens: replyTokens + REASONING_TOKENS };
}

/**
 * GPT-OSS sometimes cites tool results inline as 【…】 and adds markdown bold or
 * headings; the chat shows plain text, so buyers should never see either.
 */
function cleanReply(content) {
  if (typeof content !== 'string') return null;
  return content
    .replace(/【[^】]*】/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/[ \t]+([.,!?;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Tool-calling chat model on Groq (default GPT-OSS 120B). Retries once on rate
 * limits, server errors and timeouts; anything else surfaces as an LLMError for
 * the agent's fallback to handle. Groq rate-limits each model separately, so a
 * rate-limited request moves straight to `fallbackModel` when one is set.
 *
 * @returns {import('./llmProvider.js').LLMProvider}
 */
export function createGroqProvider({
  apiKey,
  model,
  fallbackModel,
  timeoutMs = 20_000,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error('GROQ_API_KEY is required for the Groq provider');

  /** @param {(model: string) => object} buildBody */
  async function request(buildBody) {
    let current = model;
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(buildBody(current)),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        lastError = new LLMError(`Groq request failed: ${err.message}`, { retryable: true });
      }

      if (response?.ok) return response.json();
      if (response) lastError = await errorFrom(response);
      if (!lastError.retryable || attempt === MAX_ATTEMPTS) throw lastError;
      if (lastError.status === 429 && fallbackModel && current !== fallbackModel) {
        current = fallbackModel;
        continue;
      }
      await sleep(retryDelay(response, attempt));
    }
    throw lastError;
  }

  return {
    name: 'groq',
    async complete({ messages, tools }) {
      const data = await request((current) => ({
        model: current,
        messages,
        tools: tools.map((tool) => ({ type: 'function', function: tool })),
        tool_choice: 'auto',
        parallel_tool_calls: false,
        temperature: 0.2,
        ...generationOptions(current, 700),
      }));

      const message = data?.choices?.[0]?.message;
      if (!message) throw new LLMError('Groq returned no message');

      return {
        content: cleanReply(message.content),
        toolCalls: (message.tool_calls ?? []).map((call) => ({
          id: call.id,
          name: call.function?.name,
          arguments: call.function?.arguments ?? '{}',
        })),
      };
    },

    /** JSON mode, used for the handoff summary. Returns the parsed object. */
    async completeJSON({ messages }) {
      const data = await request((current) => ({
        model: current,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0,
        ...generationOptions(current, 500),
      }));
      try {
        return JSON.parse(data?.choices?.[0]?.message?.content ?? '');
      } catch {
        throw new LLMError('Groq returned invalid JSON');
      }
    },
  };
}

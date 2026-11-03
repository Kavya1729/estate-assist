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
  let detail = '';
  try {
    detail = (await response.json())?.error?.message ?? '';
  } catch {
    // Body was not JSON; the status code is enough.
  }
  const retryable = response.status === 429 || response.status >= 500;
  return new LLMError(`Groq returned ${response.status}${detail ? `: ${detail}` : ''}`, {
    status: response.status,
    retryable,
  });
}

/**
 * Llama 3.3 70B on Groq with tool calling. Retries once on rate limits, server
 * errors and timeouts; anything else surfaces as an LLMError for the agent's
 * fallback to handle.
 *
 * @returns {import('./llmProvider.js').LLMProvider}
 */
export function createGroqProvider({ apiKey, model, timeoutMs = 20_000, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('GROQ_API_KEY is required for the Groq provider');

  async function request(body) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        lastError = new LLMError(`Groq request failed: ${err.message}`, { retryable: true });
      }

      if (response?.ok) return response.json();
      if (response) lastError = await errorFrom(response);
      if (!lastError.retryable || attempt === MAX_ATTEMPTS) throw lastError;
      await sleep(retryDelay(response, attempt));
    }
    throw lastError;
  }

  return {
    name: 'groq',
    async complete({ messages, tools }) {
      const data = await request({
        model,
        messages,
        tools: tools.map((tool) => ({ type: 'function', function: tool })),
        tool_choice: 'auto',
        parallel_tool_calls: false,
        temperature: 0.2,
        max_completion_tokens: 700,
      });

      const message = data?.choices?.[0]?.message;
      if (!message) throw new LLMError('Groq returned no message');

      return {
        content: message.content ?? null,
        toolCalls: (message.tool_calls ?? []).map((call) => ({
          id: call.id,
          name: call.function?.name,
          arguments: call.function?.arguments ?? '{}',
        })),
      };
    },
  };
}

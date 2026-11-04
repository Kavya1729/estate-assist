import { env } from '../../config/env.js';
import { createGroqProvider } from './groqProvider.js';
import { createMockProvider } from './mockProvider.js';

let provider;

/** The provider chosen by `LLM_PROVIDER`, created once per process. */
export function getLLMProvider() {
  provider ??=
    env.LLM_PROVIDER === 'groq'
      ? createGroqProvider({
          apiKey: env.GROQ_API_KEY,
          model: env.GROQ_MODEL,
          fallbackModel: env.GROQ_FALLBACK_MODEL,
        })
      : createMockProvider();
  return provider;
}

export { LLMError } from './llmProvider.js';

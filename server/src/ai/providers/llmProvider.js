/**
 * The contract every LLM provider implements. Messages and tool definitions use
 * the OpenAI chat format, which Groq speaks natively.
 *
 * @typedef {object} ToolCall
 * @property {string} id
 * @property {string} name
 * @property {string} arguments  JSON string, exactly as the model produced it
 *
 * @typedef {object} CompletionResult
 * @property {string|null} content
 * @property {ToolCall[]} toolCalls
 *
 * @typedef {object} LLMProvider
 * @property {string} name
 * @property {(request: { messages: object[], tools: object[] }) => Promise<CompletionResult>} complete
 */

/** A provider could not produce a completion (network, quota, bad response). */
export class LLMError extends Error {
  constructor(message, { status, retryable = false } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.retryable = retryable;
  }
}

import { TOOL_DEFINITIONS, runTool } from './tools/index.js';

/** After this many tool calls in one buyer turn the assistant stops and a person takes over. */
export const MAX_TOOL_CALLS_PER_TURN = 5;

const MAX_STORED_RESULT_CHARS = 4000;

/** Once a person owns the conversation the model may only write its closing message. */
const AFTER_HANDOFF = {
  ok: false,
  error:
    'The buyer has been handed to a sales executive. Do not call more tools; reply to the buyer now.',
};

/** Keeps stored tool results small; very large results are replaced by a marker. */
function storable(result) {
  return JSON.stringify(result).length > MAX_STORED_RESULT_CHARS ? { truncated: true } : result;
}

/**
 * Runs one buyer turn: call the model, execute the tools it asks for, feed the
 * results back, repeat until it answers in text.
 *
 * Returns `forcedHandoff` instead of a reply when the turn has to end without
 * the model: it exceeded the tool budget (`tool_limit`), or the provider or a
 * tool failed (`assistant_error`). The caller decides what to tell the buyer.
 * `transcript` is everything the model saw, for the post-check on its reply.
 *
 * @param {object} turn
 * @param {import('./providers/llmProvider.js').LLMProvider} turn.provider
 * @param {object[]} turn.messages  system prompt, history and the new buyer message
 * @param {{ leadId: unknown, conversationId: unknown }} turn.context
 */
export async function runAgentTurn({ provider, messages, context, logger = console }) {
  const transcript = [...messages];
  const toolCalls = [];
  let handedOff = false;

  const end = (outcome) => ({ ...outcome, toolCalls, transcript });

  for (;;) {
    let completion;
    try {
      completion = await provider.complete({ messages: transcript, tools: TOOL_DEFINITIONS });
    } catch (err) {
      logger.error(`[agent] ${provider.name} failed: ${err.message}`);
      return end({ reply: null, forcedHandoff: 'assistant_error' });
    }

    if (!completion.toolCalls.length) {
      const reply = completion.content?.trim();
      return reply
        ? end({ reply, forcedHandoff: null })
        : end({ reply: null, forcedHandoff: 'assistant_error' });
    }

    transcript.push({
      role: 'assistant',
      content: completion.content ?? null,
      tool_calls: completion.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.arguments },
      })),
    });

    for (const call of completion.toolCalls) {
      if (toolCalls.length >= MAX_TOOL_CALLS_PER_TURN) {
        logger.warn(`[agent] tool budget of ${MAX_TOOL_CALLS_PER_TURN} exhausted`);
        return end({ reply: null, forcedHandoff: 'tool_limit' });
      }

      let outcome;
      if (handedOff) {
        outcome = { name: call.name, args: {}, ok: false, result: AFTER_HANDOFF };
      } else {
        try {
          outcome = await runTool(call.name, call.arguments, context);
        } catch (err) {
          logger.error(`[agent] tool ${call.name} failed: ${err.message}`);
          return end({ reply: null, forcedHandoff: 'assistant_error' });
        }
        handedOff = outcome.name === 'handoff_to_human' && outcome.ok;
      }

      toolCalls.push({
        name: outcome.name,
        args: outcome.args,
        result: storable(outcome.result),
        ok: outcome.ok,
      });
      transcript.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome.result),
      });
    }
  }
}

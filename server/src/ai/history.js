/** How many stored messages the model sees; older ones are left out of the prompt. */
export const HISTORY_WINDOW = 20;

/**
 * Converts stored conversation messages into model messages. Earlier tool calls
 * are replayed so the model can refer back to them (e.g. a slotId it offered
 * in the previous turn). Staff replies are shown as the assistant speaking for
 * the sales team.
 */
export function toModelMessages(storedMessages) {
  const messages = [];

  storedMessages.slice(-HISTORY_WINDOW).forEach((message, index) => {
    if (message.role === 'buyer') {
      messages.push({ role: 'user', content: message.text });
      return;
    }
    if (message.role === 'staff') {
      messages.push({ role: 'assistant', content: `[Sales executive] ${message.text}` });
      return;
    }
    if (message.role !== 'assistant') return;

    const calls = message.toolCalls ?? [];
    if (calls.length) {
      const ids = calls.map((_, i) => `hist_${index}_${i}`);
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: calls.map((call, i) => ({
          id: ids[i],
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
        })),
      });
      calls.forEach((call, i) => {
        messages.push({
          role: 'tool',
          tool_call_id: ids[i],
          content: JSON.stringify(call.result ?? {}),
        });
      });
    }
    messages.push({ role: 'assistant', content: message.text });
  });

  return messages;
}

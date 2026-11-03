import { describe, expect, it, vi } from 'vitest';

import { createGroqProvider } from '../../src/ai/providers/groqProvider.js';
import { LLMError } from '../../src/ai/providers/llmProvider.js';
import { createMockProvider } from '../../src/ai/providers/mockProvider.js';

const tools = [{ name: 'get_facts', description: 'facts', parameters: { type: 'object' } }];
const messages = [{ role: 'user', content: 'price?' }];

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const toolCallBody = {
  choices: [
    {
      message: {
        content: null,
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'get_facts', arguments: '{}' } },
        ],
      },
    },
  ],
};

describe('Groq provider', () => {
  it('sends an OpenAI-style tool request and normalises tool calls', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, toolCallBody));
    const provider = createGroqProvider({
      apiKey: 'k',
      model: 'llama-3.3-70b-versatile',
      fetchImpl,
    });

    const result = await provider.complete({ messages, tools });

    expect(result).toEqual({
      content: null,
      toolCalls: [{ id: 'call_1', name: 'get_facts', arguments: '{}' }],
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer k');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'llama-3.3-70b-versatile',
      tool_choice: 'auto',
      parallel_tool_calls: false,
    });
    expect(body.tools[0]).toEqual({ type: 'function', function: tools[0] });
  });

  it('retries once on a rate limit', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { error: { message: 'slow down' } }, { 'retry-after': '0' }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { choices: [{ message: { content: 'Hello', tool_calls: [] } }] }),
      );
    const provider = createGroqProvider({ apiKey: 'k', model: 'm', fetchImpl });

    await expect(provider.complete({ messages, tools })).resolves.toMatchObject({
      content: 'Hello',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries once when the model produced a malformed tool call', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(400, {
          error: { message: 'Failed to call a function', code: 'tool_use_failed' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, toolCallBody));
    const provider = createGroqProvider({ apiKey: 'k', model: 'm', fetchImpl });

    await expect(provider.complete({ messages, tools })).resolves.toMatchObject({
      toolCalls: [{ name: 'get_facts' }],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry an invalid key and reports the reason', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { error: { message: 'Invalid API Key' } }),
    );
    const provider = createGroqProvider({ apiKey: 'bad', model: 'm', fetchImpl });

    await expect(provider.complete({ messages, tools })).rejects.toMatchObject({
      name: 'LLMError',
      status: 401,
      message: expect.stringContaining('Invalid API Key'),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats network failures as retryable, then gives up', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const provider = createGroqProvider({ apiKey: 'k', model: 'm', fetchImpl });

    await expect(provider.complete({ messages, tools })).rejects.toBeInstanceOf(LLMError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refuses to start without an API key', () => {
    expect(() => createGroqProvider({ apiKey: '', model: 'm' })).toThrow(/GROQ_API_KEY/);
  });
});

describe('mock provider', () => {
  it('replays a script and records what it was sent', async () => {
    const provider = createMockProvider({
      script: [{ content: 'one' }, () => ({ content: 'two' })],
    });

    expect((await provider.complete({ messages })).content).toBe('one');
    expect((await provider.complete({ messages })).content).toBe('two');
    await expect(provider.complete({ messages })).rejects.toThrow(/exhausted/);
    expect(provider.calls).toHaveLength(3);
  });

  it('picks a sensible tool for common demo questions', async () => {
    const provider = createMockProvider();
    const ask = async (content) =>
      (await provider.complete({ messages: [{ role: 'user', content }] })).toolCalls[0]?.name;

    expect(await ask('What is the price of a 3 BHK?')).toBe('get_facts');
    expect(await ask('Can I book a site visit on Saturday?')).toBe('get_free_slots');
    expect(await ask('I want 2 BHK under 80 lakh')).toBe('update_lead_profile');
    expect(await ask('Any discount?')).toBe('handoff_to_human');
    expect(await ask('Please ask someone to call me')).toBe('handoff_to_human');
  });
});

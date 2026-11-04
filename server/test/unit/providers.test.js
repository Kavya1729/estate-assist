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

  it('asks GPT-OSS for low reasoning effort with room for its reasoning tokens', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, toolCallBody));
    const provider = createGroqProvider({ apiKey: 'k', model: 'openai/gpt-oss-120b', fetchImpl });

    await provider.complete({ messages, tools });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBe('low');
    expect(body.max_completion_tokens).toBeGreaterThan(700);
  });

  it('sends no reasoning options to other models', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, toolCallBody));
    const provider = createGroqProvider({ apiKey: 'k', model: 'llama-3.1-8b-instant', fetchImpl });

    await provider.complete({ messages, tools });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body.max_completion_tokens).toBe(700);
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

  it('asks for JSON mode for summaries and parses the result', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: '{"needs":"3 BHK"}' } }] }),
    );
    const provider = createGroqProvider({ apiKey: 'k', model: 'm', fetchImpl });

    await expect(provider.completeJSON({ messages })).resolves.toEqual({ needs: '3 BHK' });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.tools).toBeUndefined();
  });

  it('reports JSON mode output that is not JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: 'Sure! Here is the summary' } }] }),
    );
    const provider = createGroqProvider({ apiKey: 'k', model: 'm', fetchImpl });

    await expect(provider.completeJSON({ messages })).rejects.toThrow(/invalid JSON/);
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
    expect(await ask('is there a swimming pool?')).toBe('get_facts');
    expect(await ask('who won the cricket match yesterday?')).toBe('get_facts');
    expect(await ask('how do I book a flat?')).toBe('get_facts');
  });

  describe('demo answers', () => {
    const project = (name, facts) => ({ name, location: 'Ahmedabad', configurations: [], facts });
    const projects = [
      project('Project 1', [
        { key: 'amenities', label: 'Amenities', value: 'Clubhouse, swimming pool, gym.' },
      ]),
      project('Project 2', [
        { key: 'amenities', label: 'Amenities', value: 'There is no swimming pool.' },
      ]),
    ];
    const factsTurn = (question, system = 'Their saved preference is English.') => [
      { role: 'system', content: system },
      { role: 'user', content: question },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 't1', function: { name: 'get_facts' } }],
      },
      { role: 'tool', tool_call_id: 't1', content: JSON.stringify({ ok: true, projects }) },
    ];

    it('answers from each project fact sheet', async () => {
      const { content } = await createMockProvider().complete({
        messages: factsTurn('is there a swimming pool?'),
      });

      expect(content).toContain('Project 1: Clubhouse, swimming pool, gym.');
      expect(content).toContain('Project 2: There is no swimming pool.');
    });

    it('hands off with missing_fact when the fact sheet does not cover the question', async () => {
      const provider = createMockProvider();
      const messages = factsTurn('who won the cricket match yesterday?');
      const step = await provider.complete({ messages });

      expect(step.toolCalls[0].name).toBe('handoff_to_human');
      const args = JSON.parse(step.toolCalls[0].arguments);
      expect(args.reason).toBe('missing_fact');

      const { content } = await provider.complete({
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 't2',
                function: { name: 'handoff_to_human', arguments: step.toolCalls[0].arguments },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: 't2',
            content: JSON.stringify({ ok: true, executive: 'Pooja' }),
          },
        ],
      });
      expect(content).toBe(
        "I don't have confirmed details on that. Pooja from our sales team will connect with you shortly.",
      );
    });

    it('writes its own sentences in the buyer language', async () => {
      const { content } = await createMockProvider().complete({
        messages: factsTurn('pool hai kya?', 'Their saved preference is Hindi.'),
      });

      expect(content).toContain('Project 1: Clubhouse, swimming pool, gym.');
      expect(content).toContain('साइट विज़िट');
    });

    it('replies to greetings and thanks without tools', async () => {
      const provider = createMockProvider();
      const say = (content) => provider.complete({ messages: [{ role: 'user', content }] });

      expect((await say('hello')).content).toMatch(/^Hi! I can help/);
      expect((await say('ok thanks')).toolCalls).toEqual([]);
      expect((await say('no swimming pool?')).toolCalls[0].name).toBe('get_facts');
    });
  });
});

import { describe, expect, it } from 'vitest';

import { TOOL_DEFINITIONS, runTool } from '../../src/ai/tools/index.js';
import { formatRupeeRange, formatRupees } from '../../src/lib/money.js';

describe('tool definitions', () => {
  it('exposes exactly the five assistant tools', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name)).toEqual([
      'get_facts',
      'update_lead_profile',
      'get_free_slots',
      'book_visit',
      'handoff_to_human',
    ]);
  });

  it('derives JSON schemas from the zod schemas', () => {
    const book = TOOL_DEFINITIONS.find((t) => t.name === 'book_visit');
    expect(book.parameters).toMatchObject({
      type: 'object',
      required: ['slotId'],
      additionalProperties: false,
    });
    expect(book.parameters.$schema).toBeUndefined();
  });
});

describe('runTool input validation (no database needed)', () => {
  it('rejects an unknown tool', async () => {
    const outcome = await runTool('delete_everything', '{}', {});
    expect(outcome).toMatchObject({
      ok: false,
      result: { error: 'Unknown tool: delete_everything' },
    });
  });

  it('rejects arguments that are not JSON', async () => {
    const outcome = await runTool('book_visit', '{slotId:', {});
    expect(outcome).toMatchObject({
      ok: false,
      result: { error: 'Arguments were not valid JSON.' },
    });
  });

  it('rejects arguments that fail the schema and says why', async () => {
    const outcome = await runTool('book_visit', JSON.stringify({ slotId: 'tomorrow 11am' }), {});
    expect(outcome.ok).toBe(false);
    expect(outcome.result.issues).toEqual([expect.stringMatching(/^slotId: /)]);
  });

  it('rejects unexpected fields', async () => {
    const outcome = await runTool(
      'handoff_to_human',
      JSON.stringify({ reason: 'tool_limit', summary: { needs: 'x' }, extra: 1 }),
      {},
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.result.issues.join(' ')).toMatch(/reason/);
  });
});

describe('rupee formatting', () => {
  it('uses lakh and crore', () => {
    expect(formatRupees(6_500_000)).toBe('₹65 lakh');
    expect(formatRupees(12_000_000)).toBe('₹1.2 crore');
    expect(formatRupees(95_000)).toBe('₹95,000');
    expect(formatRupeeRange({ min: 9_500_000, max: 12_000_000 })).toBe('₹95 lakh – ₹1.2 crore');
  });
});

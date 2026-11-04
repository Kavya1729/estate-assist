import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from '../../src/ai/prompt.js';

const lead = { name: 'Nidhi Shah', language: 'en', profile: {} };
const projects = [{ name: 'Project 1', code: 'P1' }];

describe('buildSystemPrompt', () => {
  it('spells out the coming week in IST so the model never computes weekdays', () => {
    // 20:00 UTC on 3 Nov is already Wednesday 4 Nov in IST.
    const prompt = buildSystemPrompt({ lead, projects, now: new Date('2026-11-03T20:00:00Z') });

    expect(prompt).toContain('Wednesday 2026-11-04 (today)');
    expect(prompt).toContain('Saturday 2026-11-07');
    expect(prompt).toContain('Wednesday 2026-11-11');
    expect(prompt).not.toContain('2026-11-12');
  });
});

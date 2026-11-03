import { describe, expect, it } from 'vitest';

import { escapeRegex, nameSimilarity, normalizeName } from '../../src/lib/names.js';

describe('normalizeName', () => {
  it.each([
    ['  Hardik   PATEL ', 'hardik patel'],
    ['Nidhi.Shah', 'nidhi shah'],
    ['José Dsouza', 'jose dsouza'],
    ['हार्दिक पटेल', 'हार्दिक पटेल'],
    ['કવિતા જોશી', 'કવિતા જોશી'],
    [undefined, ''],
  ])('normalises %s', (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });
});

describe('nameSimilarity', () => {
  it('treats spacing and case differences as the same name', () => {
    expect(nameSimilarity('Hardik Patel', 'hardik  patel')).toBe(1);
  });

  it('scores a one-letter typo as very similar', () => {
    expect(nameSimilarity('Kavita Joshi', 'Kavitha Joshi')).toBeGreaterThanOrEqual(0.85);
  });

  it('scores different people as dissimilar', () => {
    expect(nameSimilarity('Hardik Patel', 'Hardik Shah')).toBeLessThan(0.85);
    expect(nameSimilarity('Rahul', 'Rahul Shah')).toBeLessThan(0.85);
  });

  it('returns 0 when a name is missing', () => {
    expect(nameSimilarity('', 'Nidhi Shah')).toBe(0);
  });
});

describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    expect(new RegExp(`^${escapeRegex('a.b(c)')}$`).test('a.b(c)')).toBe(true);
    expect(new RegExp(`^${escapeRegex('a.b')}$`).test('axb')).toBe(false);
  });
});

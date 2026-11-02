import { describe, expect, it } from 'vitest';

import { maskPhone, normalizeIndianMobile } from '../../src/lib/phone.js';

describe('normalizeIndianMobile', () => {
  it.each([
    ['9825012345', '9825012345'],
    ['+91 98250-12345', '9825012345'],
    ['+919825012345', '9825012345'],
    ['919825012345', '9825012345'],
    ['09825012345', '9825012345'],
    ['(982) 501 2345', '9825012345'],
    [9825012345, '9825012345'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ['12345'],
    ['5825012345'],
    ['98250123456789'],
    ['+1 415 555 0100'],
    [''],
    [null],
    [undefined],
    [{}],
  ])('rejects %s', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('keeps only the first and last two digits', () => {
    expect(maskPhone('9825012345')).toBe('98xxxxxx45');
  });

  it('returns null for a missing number', () => {
    expect(maskPhone(undefined)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { parseOriginList } from '../../src/lib/origins.js';

describe('parseOriginList', () => {
  it('reads a comma-separated list, trimming spaces and trailing slashes', () => {
    expect(
      parseOriginList(
        ' https://estate-assist.vercel.app/ , http://localhost:5173,https://Estate-Assist.vercel.app',
      ),
    ).toEqual({
      origins: ['https://estate-assist.vercel.app', 'http://localhost:5173'],
      invalid: [],
    });
  });

  it('reports entries the Origin header could never match', () => {
    const { origins, invalid } = parseOriginList(
      'https://ok.example.com,https://app.example.com/login,ftp://files.example.com,not a url,*',
    );

    expect(origins).toEqual(['https://ok.example.com']);
    expect(invalid).toEqual([
      'https://app.example.com/login',
      'ftp://files.example.com',
      'not a url',
      '*',
    ]);
  });

  it('returns nothing for an empty value', () => {
    expect(parseOriginList(' , ')).toEqual({ origins: [], invalid: [] });
  });
});

import { describe, expect, it } from 'vitest';

import { detectLanguage } from '../../src/ai/guardrails/language.js';
import { findUnverifiedNumbers, knownNumbers } from '../../src/ai/guardrails/postChecks.js';
import { runPreChecks } from '../../src/ai/guardrails/preChecks.js';
import { ruleBasedSummary } from '../../src/ai/handoffSummary.js';

describe('detectLanguage', () => {
  it.each([
    ['What is the price of a 3 BHK?', 'en'],
    ['3 BHK की कीमत क्या है?', 'hi'],
    ['3 BHK ની કિંમત કેટલી છે?', 'gu'],
    ['kitne ka hai 2 bhk?', 'en'],
  ])('%s → %s', (text, language) => {
    expect(detectLanguage(text)).toBe(language);
  });

  it('returns null when there are no letters, so the saved language is kept', () => {
    expect(detectLanguage('2')).toBeNull();
    expect(detectLanguage('👍')).toBeNull();
  });
});

describe('runPreChecks', () => {
  const lead = { optedOut: false };
  const check = (text, l = lead) => runPreChecks({ text, lead: l });

  it.each([
    'Any discount if I book this week?',
    'What is your final price for the 3 BHK?',
    'Can we negotiate?',
    'Is there any Diwali offer?',
    'thoda kam ho sakta hai kya',
    'कुछ डिस्काउंट मिलेगा?',
    'आखिरी कीमत बताइए',
    'કોઈ ડિસ્કાઉન્ટ છે?',
    'છેલ્લો ભાવ શું છે?',
  ])('hands off price negotiation: %s', (text) => {
    expect(check(text)).toEqual({ type: 'handoff', reason: 'price_or_discount' });
  });

  it.each([
    'Can I talk to a person?',
    'Please call me tomorrow',
    'connect me with your sales team',
    'kisi se baat karni hai, call karo',
    'मुझे किसी इंसान से बात करनी है',
    'મારે વાત કરવી છે',
  ])('hands off a request for a person: %s', (text) => {
    expect(check(text)).toEqual({ type: 'handoff', reason: 'buyer_requested' });
  });

  it.each([
    'What is the price of a 2 BHK?',
    'What is the minimum price for 3 BHK?',
    'What do you offer in amenities?',
    'When is possession?',
  ])('lets ordinary questions through to the assistant: %s', (text) => {
    expect(check(text)).toBeNull();
  });

  it('handles STOP and blocks an opted-out buyer until START', () => {
    expect(check('STOP')).toEqual({ type: 'opt_out' });
    expect(check('please stop the ads')).toBeNull();

    const optedOut = { optedOut: true };
    expect(check('What is the price?', optedOut)).toEqual({ type: 'blocked' });
    expect(check('start', optedOut)).toEqual({ type: 'opt_in' });
  });
});

describe('number post-check', () => {
  const facts = JSON.stringify({
    configurations: [
      { bhk: 3, priceRange: '₹95 lakh – ₹1.2 crore', carpetAreaSqft: '980–1150 sq ft' },
    ],
    possession: 'December 2027',
  });
  const slots = JSON.stringify({ slots: [{ when: 'Sat, 7 Nov, 11:00 am' }] });
  const known = knownNumbers([facts, slots, 'I can spend 1.1 crore']);
  const unverified = (reply) => findUnverifiedNumbers(reply, known);

  it('accepts numbers from the fact sheet, tool results and the buyer', () => {
    expect(unverified('3 BHK is ₹95 lakh – ₹1.2 crore, 980–1150 sq ft.')).toEqual([]);
    expect(unverified('Possession is December 2027.')).toEqual([]);
    expect(unverified('You are booked for Sat, 7 Nov, 11:00 am.')).toEqual([]);
    expect(unverified('Your budget of 1.1 crore fits well.')).toEqual([]);
  });

  it('accepts the same amount written another way', () => {
    expect(unverified('That is 120 lakh at the top end.')).toEqual([]);
    expect(unverified('Starting at ₹95,00,000.')).toEqual([]);
    expect(unverified('शुरुआत ₹९५ लाख से')).toEqual([]);
  });

  it('ignores list numbering', () => {
    expect(unverified('Options:\n1) Sat, 7 Nov, 11:00 am\n2. call back')).toEqual([]);
  });

  it('catches invented prices, discounts and dates', () => {
    expect(unverified('3 BHK starts at ₹89 lakh.')).toEqual(['89 lakh']);
    expect(unverified('You get a 5% discount.')).toEqual(['5']);
    expect(unverified('Possession by March 2026.')).toEqual(['2026']);
  });
});

describe('ruleBasedSummary', () => {
  it('builds a usable note from the profile and the buyer’s messages', () => {
    const summary = ruleBasedSummary({
      lead: { profile: { bhk: 3, budgetMax: 11_000_000, timeline: '0-3m' } },
      project: { name: 'Project 1' },
      messages: [
        { role: 'buyer', text: 'Is covered parking included?' },
        { role: 'assistant', text: 'Let me check.' },
        { role: 'buyer', text: 'I am worried about possession delay' },
      ],
      latestText: 'Can I talk to someone?',
    });

    expect(summary).toEqual({
      needs: '3 BHK in Project 1 buying in 0-3m',
      budget: 'up to ₹1.1 crore',
      questions: ['Is covered parking included?', 'Can I talk to someone?'],
      concerns: ['Is covered parking included?', 'I am worried about possession delay'],
      source: 'rules',
    });
  });
});

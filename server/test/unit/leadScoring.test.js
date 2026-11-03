import { describe, expect, it } from 'vitest';

import { budgetFitsProject, scoreLead } from '../../src/services/leadScoring.js';

const LAKH = 100_000;

const project = {
  configurations: [
    { bhk: 2, priceRange: { min: 65 * LAKH, max: 82 * LAKH } },
    { bhk: 3, priceRange: { min: 95 * LAKH, max: 120 * LAKH } },
  ],
};

describe('budgetFitsProject', () => {
  it('fits when the budget overlaps the price range of the wanted BHK', () => {
    expect(
      budgetFitsProject({ bhk: 3, budgetMin: 90 * LAKH, budgetMax: 100 * LAKH }, project),
    ).toBe(true);
  });

  it('does not fit when the budget is below the cheapest unit of that BHK', () => {
    expect(budgetFitsProject({ bhk: 3, budgetMax: 80 * LAKH }, project)).toBe(false);
  });

  it('checks every configuration when BHK is unknown', () => {
    expect(budgetFitsProject({ budgetMax: 70 * LAKH }, project)).toBe(true);
  });

  it('does not fit when the budget is above the most expensive unit', () => {
    expect(
      budgetFitsProject({ bhk: 2, budgetMin: 90 * LAKH, budgetMax: 100 * LAKH }, project),
    ).toBe(false);
  });

  it('needs a budget and a project', () => {
    expect(budgetFitsProject({ bhk: 2 }, project)).toBe(false);
    expect(budgetFitsProject({ budgetMax: 70 * LAKH }, null)).toBe(false);
  });
});

describe('scoreLead', () => {
  it('scores a brand-new lead with nothing known as cold', () => {
    expect(scoreLead({ status: 'new', profile: {} }, project)).toEqual({
      score: 0,
      temperature: 'cold',
      reasons: [],
    });
  });

  it('adds up every rule and explains each point', () => {
    const result = scoreLead(
      {
        status: 'visit_booked',
        profile: { bhk: 3, budgetMax: 110 * LAKH, timeline: '0-3m' },
        consent: { given: true },
      },
      project,
    );

    expect(result.score).toBe(100);
    expect(result.temperature).toBe('hot');
    expect(result.reasons).toEqual([
      'Budget fits the project',
      'Site visit booked',
      'Plans to buy within 3 months',
      'Agreed to be contacted',
    ]);
  });

  it('uses 40 as the warm threshold and 70 as hot', () => {
    expect(scoreLead({ status: 'visit_booked', profile: {} }, project).temperature).toBe('warm');
    expect(
      scoreLead({ status: 'visit_booked', profile: { bhk: 2, budgetMax: 70 * LAKH } }, project)
        .temperature,
    ).toBe('hot');
    expect(
      scoreLead(
        { status: 'new', profile: { bhk: 2, budgetMax: 70 * LAKH }, consent: { given: true } },
        project,
      ).temperature,
    ).toBe('warm');
  });
});

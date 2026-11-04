import { describe, expect, it } from 'vitest';

import { answerFromProject, topicsOf } from '../../src/ai/factSearch.js';
import { FACT_SHEETS } from '../../src/seed/data/factSheets.js';

const project = {
  name: 'Project 1',
  location: 'Near Vaishnodevi Circle, SG Highway, Ahmedabad',
  possession: 'December 2027',
  reraNumber: 'PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/RAA11842/180324',
  configurations: [
    { bhk: 2, carpetAreaSqft: '690–760 sq ft', priceRange: '₹65 lakh – ₹78 lakh' },
    { bhk: 3, carpetAreaSqft: '1050–1240 sq ft', priceRange: '₹92 lakh – ₹1.2 crore' },
  ],
  facts: FACT_SHEETS.P1,
};

const factValue = (key) => FACT_SHEETS.P1.find((f) => f.key === key).value.replace(/[^.]$/, '$&.');
const answer = (question) => answerFromProject(question, project);

describe('fact search', () => {
  it.each([
    ['What tiles are used in the bathroom?', ['flooring', 'bathroom']],
    ['Which furniture material is given? Are wardrobes included?', ['furniture_fittings']],
    ['Is there a gas pipeline?', ['gas_pipeline']],
    ['What about the water pipeline and gas pipeline?', ['plumbing', 'gas_pipeline']],
    ['What pipes are used for plumbing?', ['plumbing']],
    ['How far is the airport and railway station?', ['connectivity']],
    ['swimming pool hai kya?', ['amenities']],
    ['पार्किंग मिलेगी?', ['parking']],
    ['પાર્કિંગ મળશે?', ['parking']],
    ['What documents do I need for a home loan?', ['documents_needed', 'home_loans']],
    ['Is the title clear and approved by AUDA?', ['approvals_legal']],
    ['What are the maintenance charges?', ['maintenance']],
    ['Any schools and hospitals nearby?', ['nearby']],
  ])('answers "%s" from the matching entries', (question, keys) => {
    expect(answer(question)).toEqual(expect.arrayContaining(keys.map(factValue)));
  });

  it('uses the core project fields for price, size, possession and RERA', () => {
    expect(answer('What is the price?')[0]).toBe(
      '2 BHK at ₹65 lakh – ₹78 lakh, 3 BHK at ₹92 lakh – ₹1.2 crore.',
    );
    expect(answer('When is possession?')[0]).toBe('Possession is planned for December 2027.');
    expect(answer('rera number?')[0]).toContain(project.reraNumber);
  });

  it('caps an answer at the first two topics the buyer mentions', () => {
    expect(topicsOf('lift, parking and gym?')).toHaveLength(2);
  });

  it('falls back to words in fact labels and values, for facts added later', () => {
    const custom = {
      ...project,
      facts: [{ key: 'temple', label: 'Temple', value: 'A small temple inside the campus' }],
    };
    expect(answerFromProject('Is there a temple?', custom)).toEqual([
      'Temple: A small temple inside the campus.',
    ]);
  });

  it('finds nothing for questions outside the fact sheet', () => {
    expect(answer('Who won the cricket match yesterday?')).toEqual([]);
    expect(answer('Tell me a joke')).toEqual([]);
  });

  it('keeps every seeded fact sheet within the admin limits', () => {
    for (const facts of Object.values(FACT_SHEETS)) {
      expect(facts.length).toBeLessThanOrEqual(60);
      expect(new Set(facts.map((f) => f.key)).size).toBe(facts.length);
      expect(facts.every((f) => f.label.length <= 80 && f.value.length <= 1000)).toBe(true);
    }
  });
});

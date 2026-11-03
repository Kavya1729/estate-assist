import { describe, expect, it } from 'vitest';

import {
  addDays,
  formatVisitTime,
  istDateOf,
  istDateTime,
  istDayStart,
} from '../../src/lib/time.js';
import { renderMessage, visitMessageVars } from '../../src/services/messageTemplates.js';

describe('IST time helpers', () => {
  it('converts IST wall-clock times to the right instant', () => {
    expect(istDateTime('2026-11-01', '11:00').toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(istDayStart('2026-11-01').toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });

  it('reads the IST calendar date of an instant late in the UTC day', () => {
    expect(istDateOf(new Date('2026-11-01T20:00:00Z'))).toBe('2026-11-02');
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('formats visit times in IST', () => {
    const visit = istDateTime('2026-11-01', '11:00');
    expect(formatVisitTime(visit, 'en')).toMatch(/1 Nov.*11:00/);
  });
});

describe('message templates', () => {
  const lead = { name: 'Hardik Patel', language: 'en' };
  const project = { name: 'Project 1', location: { address: 'SG Highway', city: 'Ahmedabad' } };
  const visit = { startsAt: istDateTime('2026-11-01', '11:00') };

  it('renders a confirmation with the visit time and address', () => {
    const body = renderMessage(
      'visit_confirmation',
      'en',
      visitMessageVars({ lead, project, visit }),
    );
    expect(body).toContain('Hi Hardik Patel');
    expect(body).toContain('Project 1');
    expect(body).toContain('SG Highway, Ahmedabad');
    expect(body).toMatch(/11:00/);
  });

  it('writes in the buyer’s language', () => {
    const vars = visitMessageVars({ lead: { ...lead, language: 'gu' }, project, visit });
    expect(renderMessage('reminder_24h', 'gu', vars)).toContain('સાઇટ વિઝિટ');
    expect(renderMessage('reminder_24h', 'hi', vars)).toContain('साइट विज़िट');
  });

  it('greets politely when the name is unknown', () => {
    const vars = visitMessageVars({ lead: { language: 'en' }, project, visit });
    expect(renderMessage('visit_confirmation', 'en', vars)).toMatch(/^Hi, your site visit/);
  });

  it('uses the map link for the two-hour reminder when there is one', () => {
    const withMap = {
      ...project,
      location: { ...project.location, mapUrl: 'https://maps.example/p1' },
    };
    const vars = visitMessageVars({ lead, project: withMap, visit });
    expect(renderMessage('reminder_2h', 'en', vars)).toContain('https://maps.example/p1');
  });
});

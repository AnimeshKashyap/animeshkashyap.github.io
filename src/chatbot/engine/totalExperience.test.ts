import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecords } from '../knowledge';
import { createEngine } from './engine';
import { createSearcher } from './search';

const QUERIES = [
  'total experience',
  'how many years of experience',
  'years of experience',
  'how experienced is he',
  'how long',
  'career length',
  'seniority',
] as const;

const TOTAL_EXPERIENCE_ID = 'faq-total-experience';

describe('dedicated grounded total-experience answer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Activated in 12b: the grounded record satisfies this regression without engine changes.
  it.each(QUERIES)('ranks the total-experience FAQ first for "%s"', (query) => {
    const hits = createSearcher(getRecords()).search(query);
    expect(hits[0]?.record.id).toBe(TOTAL_EXPERIENCE_ID);
    expect(hits[0]?.record.type).toBe('faq');
    expect(hits[0]?.record.text).toContain('8 years 7 months');
  });

  // Activated in 12b: the grounded record satisfies this regression without engine changes.
  it.each(QUERIES)('answers "%s" concisely with a grounded duration and source chip', async (query) => {
    const records = getRecords();
    const reply = await createEngine().ask(query);
    expect(reply.confident).toBe(true);
    expect(reply.text).toContain('8 years 7 months');
    expect(reply.text.length).toBeLessThanOrEqual(400);
    expect(reply.text).not.toMatch(/•|Period:|Stack:/u);
    expect(reply.text).not.toContain('Wish A Design');
    expect(reply.actions).toEqual([]);

    const faq = records.find((record) => record.id === TOTAL_EXPERIENCE_ID);
    expect(faq).toBeDefined();
    expect(reply.bubbles).toEqual([faq!.title, faq!.text]);
    expect(reply.text).toBe(reply.bubbles.join('\n\n'));
    expect(reply.sources).toEqual([{ id: TOTAL_EXPERIENCE_ID, label: faq!.source }]);
    expect(faq!.text).toContain('8 years 7 months');
  });
});

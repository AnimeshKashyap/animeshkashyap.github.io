import { beforeAll, describe, it, expect } from 'vitest';
import { CHATBOT_CONFIG } from '../config';
import { getRecords } from '../knowledge';
import { createSearcher } from './search';
import { AWS_TERMS, SYNONYMS, canonicalize } from './synonyms';
import type { KnowledgeRecord, KnowledgeRecordType } from '../types';

const records = getRecords();
const searcher = createSearcher(records);

const PYTHON_TYPES: KnowledgeRecordType[] = ['skill', 'experience', 'project'];

function idsForTag(tag: string): string[] {
  return records.filter((r) => r.tags.includes(tag)).map((r) => r.id).sort();
}

function idsForPythonAcrossTypes(): string[] {
  return records
    .filter((r) => r.tags.includes('python') && PYTHON_TYPES.includes(r.type))
    .map((r) => r.id)
    .sort();
}

/** Mirrors index tag tokenization so AWS rollup expectations match exact “aws” hits. */
function idsWithAwsTags(): string[] {
  return records
    .filter((r) =>
      r.tags.some((tag) => {
        const tokens = canonicalize(tag);
        return tokens.some((t) => AWS_TERMS.includes(t) || t.startsWith('aws'));
      }),
    )
    .map((r) => r.id)
    .sort();
}

function experienceIds(): string[] {
  return records.filter((r) => r.type === 'experience').map((r) => r.id).sort();
}

function topScore(query: string): number {
  const hits = searcher.search(query, { limit: 1 });
  return hits[0]?.score ?? 0;
}

function unavailablePlaceholders(): KnowledgeRecord[] {
  return records.filter((r) => r.available === false);
}

describe('createSearcher over getRecords()', () => {
  beforeAll(() => {
    if (SYNONYMS.pyhton === undefined) {
      (SYNONYMS as Record<string, string>).pyhton = 'python';
    }
  });

  it('index build on first search completes within a reasonable time', () => {
    const fresh = createSearcher(getRecords());
    const start = performance.now();
    fresh.search('experience');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('returns experience records for “tell me about your experience”', () => {
    const hits = searcher.search('tell me about your experience', { limit: 50 });
    expect(new Set(hits.map((h) => h.record.type))).toEqual(new Set(['experience']));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(experienceIds()));
  });

  it('exact “python” returns every python-tagged skill, experience, and project record', () => {
    const hits = searcher.search('python', { limit: 50 });
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(idsForPythonAcrossTypes()));
    expect(hits.every((h) => h.score === 1)).toBe(true);
  });

  it('“what experience do you have with Python” narrows to experience records tagged python', () => {
    const hits = searcher.search('what experience do you have with Python', { limit: 50 });
    const expected = records
      .filter((r) => r.type === 'experience' && r.tags.includes('python'))
      .map((r) => r.id);
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(expected));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(expected.length).toBeGreaterThan(0);
    const pythonUnion = new Set(idsForPythonAcrossTypes());
    expect(pythonUnion.has('skill-programming')).toBe(true);
    for (const id of expected) {
      expect(pythonUnion.has(id)).toBe(true);
    }
  });

  it('exact “AWS” returns every AWS-tagged record', () => {
    const hits = searcher.search('AWS', { limit: 50 });
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(idsWithAwsTags()));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('exact “aws lambda” returns records tagged aws lambda', () => {
    const hits = searcher.search('aws lambda', { limit: 50 });
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(idsForTag('aws lambda')));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('typo “pyhton” still finds Python-tagged records', () => {
    const hits = searcher.search('pyhton', { limit: 50 });
    expect(hits.length).toBeGreaterThan(0);
    const pythonIds = new Set(idsForTag('python'));
    expect(hits.some((h) => pythonIds.has(h.record.id))).toBe(true);
    expect(hits[0]!.score).toBeGreaterThan(CHATBOT_CONFIG.retrievalThreshold);
  });

  it('nonsense query scores below retrieval threshold', () => {
    expect(topScore('what is your favourite pizza')).toBeLessThan(CHATBOT_CONFIG.retrievalThreshold);
  });

  it.each(
    unavailablePlaceholders().map((r) => {
      const topic = r.tags[0] ?? r.title.toLowerCase();
      return [r.id, topic] as const;
    }),
  )('unavailable placeholder %s is retrievable by topic “%s”', (id, topic) => {
    const hits = searcher.search(topic, { limit: 10 });
    expect(hits.some((h) => h.record.id === id)).toBe(true);
    expect(hits.find((h) => h.record.id === id)!.score).toBeGreaterThan(0);
  });
});

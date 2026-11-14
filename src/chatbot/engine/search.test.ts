import { describe, it, expect } from 'vitest';
import { CHATBOT_CONFIG } from '../config';
import { getRecords } from '../knowledge';
import { createSearcher } from './search';
import { AWS_TERMS, canonicalize } from './synonyms';
import type { KnowledgeRecord, KnowledgeRecordType } from '../types';

const MAX_HITS = 5;

const records = getRecords();
const searcher = createSearcher(records);

const PYTHON_TYPES: KnowledgeRecordType[] = ['skill', 'experience', 'project'];

function sortLikeSearch(left: KnowledgeRecord, right: KnowledgeRecord): number {
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function topRecordIds(candidates: KnowledgeRecord[], limit = MAX_HITS): string[] {
  return [...candidates].sort(sortLikeSearch).slice(0, limit).map((r) => r.id);
}

function idsForTag(tag: string): string[] {
  return records.filter((r) => r.tags.includes(tag)).map((r) => r.id).sort();
}

function recordsForPythonAcrossTypes(): KnowledgeRecord[] {
  return records.filter((r) => r.tags.includes('python') && PYTHON_TYPES.includes(r.type));
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

function experienceRecords(): KnowledgeRecord[] {
  return records.filter((r) => r.type === 'experience');
}

function topScore(query: string): number {
  const hits = searcher.search(query, { limit: 1 });
  return hits[0]?.score ?? 0;
}

function unavailablePlaceholders(): KnowledgeRecord[] {
  return records.filter((r) => r.available === false);
}

describe('createSearcher over getRecords()', () => {

  it('index build on first search completes within a reasonable time', () => {
    const fresh = createSearcher(getRecords());
    const start = performance.now();
    fresh.search('experience');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('default search returns at most five hits', () => {
    expect(searcher.search('python').length).toBeLessThanOrEqual(MAX_HITS);
    expect(searcher.search('tell me about your experience').length).toBeLessThanOrEqual(MAX_HITS);
  });

  it('returns experience records for “tell me about your experience”', () => {
    const candidates = experienceRecords();
    const hits = searcher.search('tell me about your experience', { limit: 50 });
    expect(hits.length).toBe(Math.min(MAX_HITS, candidates.length));
    expect(new Set(hits.map((h) => h.record.type))).toEqual(new Set(['experience']));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(new Set(hits.map((h) => h.record.id))).toEqual(
      new Set(topRecordIds(candidates)),
    );
  });

  it('exact “python” returns every python-tagged skill, experience, and project record', () => {
    const candidates = recordsForPythonAcrossTypes();
    const hits = searcher.search('python', { limit: 50 });
    expect(hits.length).toBe(Math.min(MAX_HITS, candidates.length));
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(topRecordIds(candidates)));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(hits.every((h) => candidates.some((c) => c.id === h.record.id))).toBe(true);
  });

  it('“what experience do you have with Python” returns python-tagged records across types', () => {
    const candidates = recordsForPythonAcrossTypes();
    const hits = searcher.search('what experience do you have with Python', { limit: 50 });
    expect(hits.length).toBe(Math.min(MAX_HITS, candidates.length));
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(topRecordIds(candidates)));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
    expect(hits.every((h) => candidates.some((c) => c.id === h.record.id))).toBe(true);
    expect(hits.some((h) => h.record.id === 'skill-programming')).toBe(true);
    const experienceOnly = records.filter(
      (r) => r.type === 'experience' && r.tags.includes('python'),
    );
    if (experienceOnly.length < candidates.length) {
      expect(hits.some((h) => h.record.type !== 'experience')).toBe(true);
    }
  });

  it('exact “AWS” returns every AWS-tagged record', () => {
    const candidates = records.filter((r) => idsWithAwsTags().includes(r.id));
    const hits = searcher.search('AWS', { limit: 50 });
    expect(hits.length).toBe(Math.min(MAX_HITS, candidates.length));
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(topRecordIds(candidates)));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('exact “aws lambda” returns records tagged aws lambda', () => {
    const candidates = records.filter((r) => idsForTag('aws lambda').includes(r.id));
    const hits = searcher.search('aws lambda', { limit: 50 });
    expect(hits.length).toBe(Math.min(MAX_HITS, candidates.length));
    expect(new Set(hits.map((h) => h.record.id))).toEqual(new Set(topRecordIds(candidates)));
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('typo “pyhton” still finds Python-tagged records', () => {
    const hits = searcher.search('pyhton', { limit: 50 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(MAX_HITS);
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
    expect(hits.length).toBeLessThanOrEqual(MAX_HITS);
    expect(hits.some((h) => h.record.id === id)).toBe(true);
    expect(hits.find((h) => h.record.id === id)!.score).toBeGreaterThan(0);
  });
});

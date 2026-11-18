import { describe, it, expect } from 'vitest';
import { getRecords } from '../knowledge';
import { createEngine } from './engine';
import { createSearcher } from './search';

const LOW_CONFIDENCE_TEXT = "I'm not sure about that one. You can reach out to Animesh directly, or pick one of the suggested questions.";

const engine = createEngine();
const searcher = createSearcher(getRecords());

const BOUNDARY_QUERIES = [
  ['empty string', ''],
  ['whitespace only', '   \t\n  '],
  ['punctuation only', '!!! ??? ---'],
  ['stopwords only', 'the and of'],
] as const;

describe('retrieval boundary queries', () => {
  it.each(BOUNDARY_QUERIES)(
    '%s search yields no hits and engine returns low-confidence fallback',
    async (_label, query) => {
      expect(searcher.search(query)).toEqual([]);

      const reply = await engine.ask(query);
      expect(reply.text.trim().length).toBeGreaterThan(0);
      expect(reply.text).toBe(LOW_CONFIDENCE_TEXT);
      expect(reply.confident).toBe(false);
      expect(reply.sources).toEqual([]);
      expect(reply.actions).toEqual(['email', 'linkedin']);
    },
  );
});
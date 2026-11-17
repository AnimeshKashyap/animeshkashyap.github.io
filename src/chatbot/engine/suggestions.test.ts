import { describe, expect, it } from 'vitest';
import { CHATBOT_KEYWORDS } from '../config';
import { getRecords } from '../knowledge';
import type { KnowledgeRecord } from '../types';
import { buildSuggestionCorpus, SUGGESTION_CORPUS } from './suggestions';

const records = getRecords();

function fixture(overrides: Partial<KnowledgeRecord>): KnowledgeRecord {
  return {
    id: 'test-record', type: 'experience', title: 'A role — Example Company',
    text: 'Company: Example Company', tags: [], source: 'Test', available: true,
    ...overrides,
  };
}

describe('autocomplete sentence corpus', () => {
  it('contains 25–40 unique complete sentences in deterministic order', () => {
    expect(SUGGESTION_CORPUS.length).toBeGreaterThanOrEqual(25);
    expect(SUGGESTION_CORPUS.length).toBeLessThanOrEqual(40);
    expect(new Set(SUGGESTION_CORPUS).size).toBe(SUGGESTION_CORPUS.length);
    expect(SUGGESTION_CORPUS.every((sentence) =>
      sentence === sentence.trim() && sentence.split(/\s+/).length >= 4 && /[.?]$/.test(sentence),
    )).toBe(true);
    expect(buildSuggestionCorpus(records)).toEqual(SUGGESTION_CORPUS);
    expect(buildSuggestionCorpus(records)).toEqual(buildSuggestionCorpus(records));
  });

  it('starts with every canonical keyword and includes social profile questions', () => {
    expect(SUGGESTION_CORPUS.slice(0, CHATBOT_KEYWORDS.length)).toEqual(
      CHATBOT_KEYWORDS.map(({ query }) => query),
    );
    expect(SUGGESTION_CORPUS).toContain('Where can I find his LinkedIn profile?');
    expect(SUGGESTION_CORPUS).toContain('Where can I find his GitHub profile?');
  });

  it('covers every available company twice and every project and skill group once', () => {
    for (const record of records.filter(({ available }) => available)) {
      if (record.type === 'experience') {
        const company = record.text.match(/^Company: (.+)$/m)?.[1];
        expect(company).toBeDefined();
        expect(SUGGESTION_CORPUS).toContain(`What was his role at ${company}?`);
        expect(SUGGESTION_CORPUS).toContain(`Which technologies did he use at ${company}?`);
      } else if (record.type === 'project') {
        expect(SUGGESTION_CORPUS).toContain(`Tell me about his ${record.title} project.`);
      } else if (record.type === 'skill') {
        expect(SUGGESTION_CORPUS).toContain(`What are his skills in ${record.title}?`);
      }
    }
  });

  it('derives names from supplied records without modifying them', () => {
    const input = [
      fixture({ text: 'Company: Renamed & Co.' }),
      fixture({ type: 'project', title: 'Renamed Project' }),
      fixture({ type: 'skill', title: 'Renamed Skills' }),
    ];
    const before = structuredClone(input);
    const corpus = buildSuggestionCorpus(input);
    expect(corpus.slice(CHATBOT_KEYWORDS.length + 2)).toEqual([
      'What was his role at Renamed & Co.?',
      'Which technologies did he use at Renamed & Co.?',
      'Tell me about his Renamed Project project.',
      'What are his skills in Renamed Skills?',
    ]);
    expect(input).toEqual(before);
  });

  it('skips unavailable or missing company records and deduplicates stably', () => {
    const company = fixture({});
    expect(buildSuggestionCorpus([
      company, company,
      fixture({ available: false, text: 'Company: Unavailable Company' }),
      fixture({ text: 'Role: No company field' }),
      fixture({ type: 'unavailable', title: 'Unknown topic' }),
    ])).toEqual([
      ...buildSuggestionCorpus([]),
      'What was his role at Example Company?',
      'Which technologies did he use at Example Company?',
    ]);
  });

  it('reports the current grounded corpus size', () => {
    console.info(`Autocomplete corpus: ${SUGGESTION_CORPUS.length} sentences`);
    expect(SUGGESTION_CORPUS.length).toBe(36);
  });
});

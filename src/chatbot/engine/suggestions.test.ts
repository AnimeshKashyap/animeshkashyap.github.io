import { describe, expect, it, vi } from 'vitest';
import * as knowledge from '../knowledge';
import { CHATBOT_KEYWORDS } from '../config';
import { getRecords } from '../knowledge';
import type { KnowledgeRecord } from '../types';
import { buildSuggestionCorpus, SUGGESTION_CORPUS, suggest } from './suggestions';

describe('ranked autocomplete matching', () => {
  it('requires two normalized typed characters and returns no unrelated results', () => {
    for (const prefix of ['', ' ', 'a', 'a !', '?!', 'unmatchablexyz', 'skills unmatchablexyz']) {
      expect(suggest(prefix)).toEqual([]);
    }
    expect(suggest('wh')).toHaveLength(3);
  });

  it('ranks sentence starts ahead of word starts and aliases in stable corpus order', () => {
    expect(suggest('which')).toEqual([
      'Which technologies and skills does he focus on?',
      ...SUGGESTION_CORPUS.filter((sentence) => sentence.startsWith('Which technologies did')).slice(0, 2),
    ]);
    expect(suggest('how')).toEqual(CHATBOT_KEYWORDS
      .map(({ query }) => query).filter((query) => query.startsWith('How')));
    expect(suggest('technologies')[0]).toBe('Which technologies and skills does he focus on?');
    expect(suggest('project')[0]).toBe('What projects has he built?');
    // The literal work match stays ahead of synonym-only experience matches.
    expect(suggest('work')).toEqual([
      'Summarize his work experience.',
      'How many years of experience does he have?',
    ]);
  });

  it('matches every token at word starts in any order, not arbitrary substrings', () => {
    expect(suggest('ski whi')[0]).toBe('Which technologies and skills does he focus on?');
    expect(suggest('whi ski')).toEqual(suggest('ski whi'));
    expect(suggest('kills')).toEqual([]);
    expect(suggest('skills nonexistent')).toEqual([]);
  });

  it('uses category, technical, and multiword aliases from synonyms', () => {
    expect(suggest('career')[0]).toBe('Summarize his work experience.');
    expect(suggest('college')).toEqual(['What is his education?']);
    expect(suggest('curriculum vitae')).toEqual(['How can I download his resume?']);
    expect(suggest('tech stack')[0]).toBe('Which technologies and skills does he focus on?');
  });

  it('normalizes case, punctuation, accents, and whitespace without changing output copy', () => {
    expect(suggest('  WHÍCH,,,   SKÍ  ')).toEqual(suggest('which ski'));
    expect(suggest('RÉSUMÉ')).toEqual(suggest('resume'));
    expect(suggest('CV')).toEqual(['How can I download his resume?']);
  });

  it('caps limits at three, handles empty limits, and returns independent deduplicated arrays', () => {
    expect(suggest('what', 1)).toHaveLength(1);
    expect(suggest('what', 2)).toHaveLength(2);
    expect(suggest('what', 99)).toHaveLength(3);
    for (const limit of [0, -1, NaN]) expect(suggest('what', limit)).toEqual([]);
    expect(suggest('what', 1.9)).toHaveLength(1);
    const result = suggest('what');
    expect(new Set(result).size).toBe(result.length);
    result.length = 0;
    expect(suggest('what')).toHaveLength(3);
  });

  it('reuses the initialized corpus across repeated keystrokes without reading records again', () => {
    const getRecordsSpy = vi.spyOn(knowledge, 'getRecords');
    try {
      const expected = suggest('what');
      for (const prefix of ['wh', 'what', 'college', 'RÉSUMÉ', 'what']) suggest(prefix);
      expect(suggest('what')).toEqual(expected);
      expect(getRecordsSpy).not.toHaveBeenCalled();
    } finally {
      getRecordsSpy.mockRestore();
    }
  });

  it('never returns the exact normalized typed sentence', () => {
    for (const sentence of SUGGESTION_CORPUS) {
      expect(suggest(sentence.toUpperCase().replace(/[.?]/g, '!'))).not.toContain(sentence);
    }
  });
});

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

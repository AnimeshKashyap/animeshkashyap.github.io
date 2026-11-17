import { describe, it, expect } from 'vitest';
import { CHATBOT_KEYWORDS } from '../config';
import { getRecords } from '../knowledge';
import type { ActionId, KnowledgeRecord, KnowledgeRecordType } from '../types';
import { createEngine } from './engine';

const engine = createEngine();
const recordsById = new Map(getRecords().map((record) => [record.id, record]));

const LOW_CONFIDENCE_TEXT = "I don't have that in the CV.";

function fieldValue(text: string, label: string): string | undefined {
  const prefix = `${label}: `;
  for (const line of text.split('\n')) {
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim();
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}

function companyNamesFromCatalog(): string[] {
  const names = new Set<string>();
  for (const record of getRecords()) {
    const company = fieldValue(record.text, 'Company');
    if (company !== undefined) {
      names.add(company);
    }
  }
  return [...names].sort((a, b) => b.length - a.length);
}

function stackTokensFromRecord(record: KnowledgeRecord): string[] {
  const stack = fieldValue(record.text, 'Stack');
  if (stack === undefined) {
    return [];
  }
  return stack
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function catalogStackTokens(): string[] {
  const tokens = new Set<string>();
  for (const record of getRecords()) {
    for (const token of stackTokensFromRecord(record)) {
      tokens.add(token);
    }
  }
  return [...tokens].sort((a, b) => b.length - a.length);
}

function recordCorpus(record: KnowledgeRecord): string {
  return `${record.title}\n${record.text}`;
}

function experienceRecordsNewestFirst(): KnowledgeRecord[] {
  return getRecords().filter((record) => record.type === 'experience');
}

function companyFromExperienceBullet(line: string): string | undefined {
  const match = /^•\s+.+ @ (.+?) \(/u.exec(line);
  return match?.[1];
}

function companiesFromExperienceAggregate(text: string): string[] {
  return text
    .split('\n')
    .map((line) => companyFromExperienceBullet(line))
    .filter((company): company is string => company !== undefined);
}

function assertReplyLexicon(replyText: string, sourceRecords: KnowledgeRecord[]): void {
  const corpus = sourceRecords.map(recordCorpus).join('\n');
  const lowerReply = replyText.toLowerCase();
  const lowerCorpus = corpus.toLowerCase();
  for (const company of companyNamesFromCatalog()) {
    if (replyText.includes(company) && !corpus.includes(company)) {
      expect.fail(`reply mentions company "${company}" absent from sources`);
    }
  }
  for (const token of catalogStackTokens()) {
    const needle = token.toLowerCase();
    if (lowerReply.includes(needle) && !lowerCorpus.includes(needle)) {
      expect.fail(`reply mentions technology "${token}" absent from sources`);
    }
  }
}

type GoldenExpectation = {
  confident: boolean;
  actions: readonly ActionId[];
  sourcesEmpty?: boolean;
  minSources?: number;
  sourceTypes?: readonly KnowledgeRecordType[];
  sourceIdsIncludes?: readonly string[];
  textIncludes?: readonly string[];
  lexiconGrounded?: boolean;
};

const GOLDEN_VISITOR_QUESTIONS: readonly [string, GoldenExpectation][] = [
  ['hello', { confident: true, actions: [], sourcesEmpty: true }],
  ['what can you do', { confident: true, actions: [], sourcesEmpty: true }],
  ['open linkedin', { confident: true, actions: ['linkedin'], sourcesEmpty: true }],
  ['show me github', { confident: true, actions: ['github'], sourcesEmpty: true }],
  ['download your cv', { confident: true, actions: ['cv'], sourcesEmpty: true }],
  ['scroll to projects', { confident: true, actions: ['projects'], sourcesEmpty: true }],
  ['get in touch', { confident: true, actions: ['email'], sourcesEmpty: true }],
  [
    'email him and download his resume',
    { confident: true, actions: ['email', 'cv'], sourcesEmpty: true },
  ],
  [
    'how can I contact you',
    {
      confident: true,
      actions: ['email'],
      minSources: 1,
      sourceIdsIncludes: ['faq-contact'],
      lexiconGrounded: true,
    },
  ],
  [
    "What is Animesh's professional background?",
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceTypes: ['profile'],
      lexiconGrounded: true,
    },
  ],
  [
    'Which technologies and skills does he focus on?',
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceTypes: ['skill'],
      lexiconGrounded: true,
    },
  ],
  [
    'Summarize his work experience.',
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceTypes: ['experience'],
      lexiconGrounded: true,
    },
  ],
  [
    'What projects has he built?',
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceTypes: ['faq'],
      lexiconGrounded: true,
    },
  ],
  [
    'Where did he study at KCC Institute?',
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceTypes: ['education'],
      lexiconGrounded: true,
    },
  ],
  [
    'What languages does he speak?',
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceIdsIncludes: ['edu-languages'],
      lexiconGrounded: true,
    },
  ],
  [
    'awards and certifications',
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceTypes: ['education'],
      lexiconGrounded: true,
    },
  ],
  [
    'what experience do you have with Python',
    {
      confident: true,
      actions: [],
      minSources: 1,
      lexiconGrounded: true,
    },
  ],
  ['aws lambda', { confident: true, actions: [], minSources: 1, lexiconGrounded: true }],
  ['pyhton', { confident: true, actions: [], minSources: 1, lexiconGrounded: true }],
  [
    'tell me about his time at OneAssist',
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceTypes: ['experience'],
      textIncludes: ['OneAssist'],
      lexiconGrounded: true,
    },
  ],
  [
    'Real-Time Chat Application',
    {
      confident: true,
      actions: [],
      minSources: 1,
      sourceTypes: ['project'],
      lexiconGrounded: true,
    },
  ],
  [
    'what are his salary expectations',
    {
      confident: true,
      actions: ['email'],
      sourceIdsIncludes: ['unavailable-salary-expectations'],
      lexiconGrounded: true,
    },
  ],
  [
    'work visa and right to work',
    {
      confident: true,
      actions: ['email'],
      sourceIdsIncludes: ['unavailable-work-authorization'],
      lexiconGrounded: true,
    },
  ],
  [
    'what is your favourite pizza',
    {
      confident: false,
      actions: ['email'],
      sourcesEmpty: true,
      textIncludes: [LOW_CONFIDENCE_TEXT],
    },
  ],
  [
    'does he have a pet cat named fluffy',
    {
      confident: false,
      actions: ['email'],
      sourcesEmpty: true,
      textIncludes: [LOW_CONFIDENCE_TEXT],
    },
  ],
];

describe('golden visitor questions', () => {
  it.each(GOLDEN_VISITOR_QUESTIONS)('"%s"', async (query, expected) => {
    const reply = await engine.ask(query);
    expect(reply.text.length).toBeGreaterThan(0);
    expect(reply.bubbles.join('\n\n')).toBe(reply.text);
    expect(reply.bubbles.length).toBeGreaterThan(0);
    expect(reply.bubbles.length).toBeLessThanOrEqual(5);
    expect(reply.bubbles.every((bubble) => bubble.trim().length > 0 && bubble.length <= 400)).toBe(true);
    if (['hello', 'what can you do', 'Summarize his work experience.',
      'Which technologies and skills does he focus on?', 'Real-Time Chat Application'].includes(query)) {
      expect(reply.bubbles.length).toBeGreaterThan(1);
    }
    expect(reply.confident).toBe(expected.confident);
    expect(reply.actions).toEqual([...expected.actions]);

    if (expected.sourcesEmpty === true) {
      expect(reply.sources).toEqual([]);
    }

    if (expected.minSources !== undefined) {
      expect(reply.sources.length).toBeGreaterThanOrEqual(expected.minSources);
    }

    const matched = reply.sources
      .map((chip) => recordsById.get(chip.id))
      .filter((record): record is KnowledgeRecord => record !== undefined);
    expect(matched.length).toBe(reply.sources.length);

    if (expected.sourceIdsIncludes !== undefined) {
      const ids = new Set(reply.sources.map((chip) => chip.id));
      for (const id of expected.sourceIdsIncludes) {
        expect(ids.has(id)).toBe(true);
      }
    }

    if (expected.sourceTypes !== undefined) {
      const types = new Set(matched.map((record) => record.type));
      for (const type of expected.sourceTypes) {
        expect(types.has(type)).toBe(true);
      }
    }

    if (expected.textIncludes !== undefined) {
      for (const snippet of expected.textIncludes) {
        expect(reply.text).toContain(snippet);
      }
    }

    const shouldGroundLexicon =
      expected.lexiconGrounded === true ||
      (expected.lexiconGrounded !== false &&
        reply.confident &&
        matched.length > 0 &&
        expected.sourcesEmpty !== true);
    if (shouldGroundLexicon) {
      assertReplyLexicon(reply.text, matched);
    }
  });

  it('unknown questions stay below the retrieval threshold', async () => {
    const reply = await engine.ask('what is your favourite pizza');
    expect(reply.confident).toBe(false);
    expect(reply.actions).toEqual(['email']);
  });

  it('confident retrieval never returns empty reply text', async () => {
    for (const [query, expected] of GOLDEN_VISITOR_QUESTIONS) {
      if (!expected.confident || expected.sourcesEmpty === true) {
        continue;
      }
      const reply = await engine.ask(query);
      expect(reply.text.trim().length).toBeGreaterThan(0);
      if (expected.minSources !== undefined && expected.minSources > 0) {
        expect(reply.sources.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(CHATBOT_KEYWORDS)('$label resolves confidently without suggesting itself', async ({ label, query }) => {
    const reply = await engine.ask(query);
    expect(reply.confident).toBe(true);
    expect(reply.suggestions.length).toBeLessThanOrEqual(4);
    expect(reply.suggestions).not.toContain(label);
    expect(new Set(reply.suggestions).size).toBe(reply.suggestions.length);
    for (const suggestion of reply.suggestions) {
      expect(CHATBOT_KEYWORDS.map((keyword) => keyword.label)).toContain(suggestion);
    }
  });

  it('offers related keywords after Experience', async () => {
    const reply = await engine.ask('Summarize his work experience.');
    expect(reply.suggestions.slice(0, 3)).toEqual(['Skills', 'Projects', 'Total Experience']);
  });

  it('suggested follow-ups on confident replies come from the configured pool', async () => {
    const reply = await engine.ask('Which technologies and skills does he focus on?');
    expect(reply.confident).toBe(true);
    expect(reply.suggestions.length).toBeGreaterThan(0);
    expect(reply.suggestions.length).toBeLessThanOrEqual(4);
    for (const suggestion of reply.suggestions) {
      expect(CHATBOT_KEYWORDS.map(({ label }) => label)).toContain(suggestion);
    }
  });

  it('Summarize his work experience lists roles newest-first with text order matching sources', async () => {
    const query = 'Summarize his work experience.';
    const reply = await engine.ask(query);
    expect(reply.confident).toBe(true);
    expect(reply.sources.length).toBeGreaterThan(1);

    const chronology = experienceRecordsNewestFirst();
    const retrievedIds = new Set(reply.sources.map((chip) => chip.id));
    const expectedSourceLabels = chronology
      .filter((record) => retrievedIds.has(record.id))
      .map((record) => record.source);
    const sourceLabels = reply.sources.map((chip) => chip.label);

    expect(sourceLabels).toEqual(expectedSourceLabels);
    expect(companiesFromExperienceAggregate(reply.text)).toEqual(
      expectedSourceLabels.map((label) => label.replace(/^Experience: /u, '')),
    );
  });
});
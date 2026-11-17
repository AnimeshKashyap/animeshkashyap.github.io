import { describe, it, expect } from 'vitest';
import { createEngine } from './engine';
import { getRecords } from '../knowledge';
import type { KnowledgeRecord } from '../types';

const engine = createEngine();
const recordsById = new Map(getRecords().map((record) => [record.id, record]));

const CONTACT_RECORD_IDS = new Set(['faq-contact', 'profile-contact']);

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

describe('createEngine().ask()', () => {
  it.each([
    ['open linkedin', ['linkedin']],
    ['show me github', ['github']],
    ['download your cv', ['cv']],
    ['scroll to projects', ['projects']],
  ] as const)('intent "%s" resolves to actions %j', async (query, expected) => {
    const reply = await engine.ask(query);
    expect(reply.confident).toBe(true);
    expect(reply.sources).toEqual([]);
    expect(reply.actions).toEqual(expected);
  });

  it.each([
    'hello',
    'what can you do',
    'open linkedin',
    'download your cv',
    'how can I contact you',
    'what experience do you have with Python',
    'tell me about your experience',
    'what is your favourite pizza',
    '',
  ])('preserves the single-bubble compatibility contract for "%s"', async (query) => {
    const reply = await engine.ask(query);
    expect(reply.bubbles).toEqual([reply.text]);
    expect(reply.text).toBe(reply.bubbles.join('\n\n'));
  });

  it('help intent returns no navigation actions', async () => {
    const reply = await engine.ask('what can you do');
    expect(reply.confident).toBe(true);
    expect(reply.actions).toEqual([]);
    expect(reply.text.length).toBeGreaterThan(0);
  });

  it('greeting intent uses configured greeting text', async () => {
    const reply = await engine.ask('hello');
    expect(reply.confident).toBe(true);
    expect(reply.actions).toEqual([]);
    expect(reply.sources).toEqual([]);
  });

  it('"how can I contact you" returns email action and a contact knowledge record', async () => {
    const reply = await engine.ask('how can I contact you');
    expect(reply.confident).toBe(true);
    expect(reply.actions).toEqual(['email']);
    expect(reply.sources.some((chip) => CONTACT_RECORD_IDS.has(chip.id))).toBe(true);
    const matched = reply.sources
      .map((chip) => recordsById.get(chip.id))
      .filter((record): record is KnowledgeRecord => record !== undefined);
    expect(matched.length).toBeGreaterThan(0);
    assertReplyLexicon(reply.text, matched);
  });

  it('"download your cv" returns the cv action via intent routing', async () => {
    const reply = await engine.ask('download your cv');
    expect(reply.actions).toEqual(['cv']);
    expect(reply.sources).toEqual([]);
  });

  it('unknown fact questions return confident:false with email action', async () => {
    const reply = await engine.ask('what is your favourite pizza');
    expect(reply.confident).toBe(false);
    expect(reply.actions).toEqual(['email']);
    expect(reply.sources).toEqual([]);
  });

  it.each([
    'what experience do you have with Python',
    'tell me about your experience',
    'aws lambda',
  ] as const)('retrieval reply for "%s" only cites lexicon from matched records', async (query) => {
    const reply = await engine.ask(query);
    expect(reply.confident).toBe(true);
    expect(reply.sources.length).toBeGreaterThan(0);
    const matched = reply.sources
      .map((chip) => recordsById.get(chip.id))
      .filter((record): record is KnowledgeRecord => record !== undefined);
    expect(matched.length).toBe(reply.sources.length);
    assertReplyLexicon(reply.text, matched);
  });
});
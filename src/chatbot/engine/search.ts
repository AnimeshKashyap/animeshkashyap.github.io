import MiniSearch from 'minisearch';
// Sole production import of `minisearch`. Keep this module behind the chatbot
// panel's dynamic import (launcher → `import('./panel/panel')` → engine), not in
// `chatbot/index`, launcher, or page entry chunks, so MiniSearch stays lazy.
import type { KnowledgeRecord, KnowledgeRecordType } from '../types';
import { AWS_TERMS, canonicalize, normalize } from './synonyms';

const DEFAULT_LIMIT = 5;

/** Raw MiniSearch scores are unbounded. This scale squashes them into (0, 1). */
const CONFIDENCE_SCALE = 2;

const FIELD_BOOST = {
  title: 5,
  tags: 3,
  aliases: 2,
  text: 1,
} as const;

/**
 * Fuzzy ratio stays ~0.2. MiniSearch uses Levenshtein, so one adjacent swap
 * costs 2, but `round(length * 0.2)` is only 1 for 6–7 character terms
 * ("pyhton" would miss "python"). Those lengths use an absolute distance of 2.
 */
function fuzzyOption(term: string): number {
  const ratio = 0.2;
  const distance = Math.round(term.length * ratio);
  return distance === 1 && term.length >= 6 ? 2 : ratio;
}

const MINI_SEARCH_OPTIONS = {
  boost: { ...FIELD_BOOST },
  fuzzy: fuzzyOption,
  prefix: true,
};

const TYPE_KEYS: Readonly<Record<string, KnowledgeRecordType>> = {
  experience: 'experience',
  skills: 'skill',
  projects: 'project',
  education: 'education',
};

const KEY_FOR_TYPE: Partial<Record<KnowledgeRecordType, string>> = {
  experience: 'experience',
  skill: 'skills',
  project: 'projects',
  education: 'education',
};

const TYPE_KEY_SET: ReadonlySet<string> = new Set(Object.keys(TYPE_KEYS));

const GENERIC_ENTITY: ReadonlySet<string> = new Set([
  'pvt',
  'ltd',
  'limited',
  'private',
  'llc',
  'inc',
  'company',
  'companies',
  'technologies',
  'technology',
  'consulting',
  'solutions',
  'solution',
  'international',
  'software',
  'engineering',
  'consumer',
  'services',
  'service',
  'india',
  'group',
  'institute',
  'management',
  'public',
  'school',
  'college',
  'university',
  'science',
  'computer',
  'and',
  'the',
  'of',
]);

const LABELED_ENTITY = /^(?:company|client|school):\s*(.+)$/iu;

export interface SearchHit {
  record: KnowledgeRecord;
  score: number;
}

export interface SearchOptions {
  limit?: number;
}

export interface Searcher {
  search(query: string, options?: SearchOptions): SearchHit[];
}

interface SearchDocument {
  id: string;
  title: string;
  text: string;
  tags: string;
  aliases: string;
}

interface BuiltIndex {
  mini: MiniSearch<SearchDocument>;
  recordsById: Map<string, KnowledgeRecord>;
  specific: Map<string, KnowledgeRecord[]>;
  types: Map<string, KnowledgeRecord[]>;
}

interface EntityMatch {
  key: string;
  length: number;
}

function addTo(map: Map<string, KnowledgeRecord[]>, key: string, record: KnowledgeRecord): void {
  if (key.length === 0) {
    return;
  }
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [record]);
    return;
  }
  if (!existing.some((item) => item.id === record.id)) {
    existing.push(record);
  }
}

function union(groups: readonly (readonly KnowledgeRecord[])[]): KnowledgeRecord[] {
  const byId = new Map<string, KnowledgeRecord>();
  for (const group of groups) {
    for (const record of group) {
      byId.set(record.id, record);
    }
  }
  return [...byId.values()];
}

function isDistinctive(token: string): boolean {
  return token.length >= 3 && !GENERIC_ENTITY.has(token) && !/^\d+$/u.test(token);
}

function indexableTagToken(token: string): boolean {
  if (/^\d+$/u.test(token) || TYPE_KEY_SET.has(token)) {
    return false;
  }
  return token.length >= 2 || token === 'c';
}

function addNamedEntity(
  name: string,
  record: KnowledgeRecord,
  specific: Map<string, KnowledgeRecord[]>,
): void {
  const tokens = canonicalize(name);
  if (tokens.length === 0) {
    return;
  }
  addTo(specific, tokens.join(' '), record);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (token !== undefined && isDistinctive(token)) {
      addTo(specific, token, record);
    }
    if (
      token !== undefined &&
      next !== undefined &&
      (isDistinctive(token) || isDistinctive(next))
    ) {
      addTo(specific, `${token} ${next}`, record);
    }
  }
}

function indexTags(
  record: KnowledgeRecord,
  specific: Map<string, KnowledgeRecord[]>,
  types: Map<string, KnowledgeRecord[]>,
): void {
  for (const tag of record.tags) {
    const tokens = canonicalize(tag);
    if (tokens.length === 0) {
      continue;
    }
    const phrase = tokens.join(' ');
    if (TYPE_KEY_SET.has(phrase)) {
      addTo(types, phrase, record);
      continue;
    }
    addTo(specific, phrase, record);
    if (tokens.length < 2) {
      continue;
    }
    for (const token of tokens) {
      if (TYPE_KEY_SET.has(token)) {
        addTo(types, token, record);
      } else if (indexableTagToken(token)) {
        addTo(specific, token, record);
      }
    }
  }
}

function indexRecord(
  record: KnowledgeRecord,
  specific: Map<string, KnowledgeRecord[]>,
  types: Map<string, KnowledgeRecord[]>,
): void {
  const typeKey = KEY_FOR_TYPE[record.type];
  if (typeKey !== undefined) {
    addTo(types, typeKey, record);
  }

  indexTags(record, specific, types);

  for (const line of record.text.split('\n')) {
    const match = LABELED_ENTITY.exec(line.trim());
    if (match?.[1] !== undefined) {
      addNamedEntity(match[1], record, specific);
    }
  }

  for (const alias of record.aliases ?? []) {
    const phrase = canonicalize(alias).join(' ');
    if (phrase.length > 0) {
      addTo(specific, phrase, record);
    }
  }
}

function rollupAws(specific: Map<string, KnowledgeRecord[]>): void {
  const combined = new Map<string, KnowledgeRecord>();
  for (const key of AWS_TERMS) {
    for (const record of specific.get(key) ?? []) {
      combined.set(record.id, record);
    }
  }
  if (combined.size > 0) {
    specific.set('aws', [...combined.values()]);
  }
}

function buildIndex(records: readonly KnowledgeRecord[]): BuiltIndex {
  const recordsById = new Map<string, KnowledgeRecord>();
  const documents: SearchDocument[] = [];
  const specific = new Map<string, KnowledgeRecord[]>();
  const types = new Map<string, KnowledgeRecord[]>();

  for (const record of records) {
    if (recordsById.has(record.id)) {
      continue;
    }
    recordsById.set(record.id, record);
    documents.push({
      id: record.id,
      title: record.title,
      text: record.text,
      tags: record.tags.join(' '),
      aliases: (record.aliases ?? []).join(' '),
    });
    indexRecord(record, specific, types);
  }

  rollupAws(specific);

  const mini = new MiniSearch<SearchDocument>({
    fields: ['title', 'text', 'tags', 'aliases'],
    idField: 'id',
    searchOptions: MINI_SEARCH_OPTIONS,
    tokenize: (text: string) => canonicalize(text),
  });
  mini.addAll(documents);

  return { mini, recordsById, specific, types };
}

function longestKey(tokens: readonly string[], start: number, index: BuiltIndex): EntityMatch | undefined {
  const max = Math.min(8, tokens.length - start);
  for (let length = max; length >= 1; length -= 1) {
    const key = tokens.slice(start, start + length).join(' ');
    if (index.specific.has(key) || index.types.has(key)) {
      return { key, length };
    }
  }
  return undefined;
}

function exactRecords(index: BuiltIndex, tokens: readonly string[]): KnowledgeRecord[] {
  const specificGroups: KnowledgeRecord[][] = [];
  const typeGroups: KnowledgeRecord[][] = [];

  for (let cursor = 0; cursor < tokens.length; ) {
    const match = longestKey(tokens, cursor, index);
    if (match === undefined) {
      cursor += 1;
      continue;
    }
    const specificHits = index.specific.get(match.key);
    const typeHits = index.types.get(match.key);
    if (specificHits !== undefined) {
      specificGroups.push(specificHits);
    }
    if (typeHits !== undefined) {
      typeGroups.push(typeHits);
    }
    cursor += match.length;
  }

  if (specificGroups.length === 0 && typeGroups.length === 0) {
    return [];
  }

  const specificHits = union(specificGroups);
  const typeHits = union(typeGroups);
  if (specificHits.length === 0) {
    return typeHits;
  }
  if (typeHits.length === 0) {
    return specificHits;
  }

  const allowedTypes = new Set(typeHits.map((record) => record.type));
  const filtered = specificHits.filter((record) => allowedTypes.has(record.type));
  return filtered.length > 0 ? filtered : specificHits;
}

function toConfidence(rawScore: number): number {
  if (!Number.isFinite(rawScore) || rawScore <= 0) {
    return 0;
  }
  const confidence = rawScore / (rawScore + CONFIDENCE_SCALE);
  return confidence >= 1 ? 1 : confidence;
}

function resolveLimit(options: SearchOptions | undefined): number {
  const requested = options?.limit ?? DEFAULT_LIMIT;
  if (!Number.isFinite(requested) || requested <= 0) {
    return 0;
  }
  return Math.floor(requested);
}

function fuzzyHits(index: BuiltIndex, tokens: readonly string[], limit: number): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const result of index.mini.search(tokens.join(' '), MINI_SEARCH_OPTIONS)) {
    if (hits.length >= limit) {
      break;
    }
    if (typeof result.id !== 'string') {
      continue;
    }
    const record = index.recordsById.get(result.id);
    if (record === undefined) {
      continue;
    }
    const score = toConfidence(result.score);
    if (score <= 0) {
      continue;
    }
    hits.push({ record, score });
  }
  return hits;
}

function runSearch(index: BuiltIndex, tokens: readonly string[], limit: number): SearchHit[] {
  const exact = exactRecords(index, tokens);
  const hits =
    exact.length > 0
      ? exact.map((record) => ({ record, score: 1 }))
      : fuzzyHits(index, tokens, limit);

  hits.sort(
    (left, right) =>
      right.score - left.score ||
      left.record.title.localeCompare(right.record.title) ||
      left.record.id.localeCompare(right.record.id),
  );
  return hits;
}

/**
 * Build a searcher over `records`. The MiniSearch index is created on the first
 * `search` call. `search` normalizes the query, returns every record for an
 * exact technology or company hit, and otherwise the top `limit` (default 5).
 * `score` is a confidence in 0..1.
 */
export function createSearcher(records: readonly KnowledgeRecord[]): Searcher {
  let built: BuiltIndex | undefined;

  return {
    search(query: string, options?: SearchOptions): SearchHit[] {
      const limit = resolveLimit(options);
      if (limit === 0) {
        return [];
      }
      const tokens = normalize(query);
      if (tokens.length === 0) {
        return [];
      }
      built ??= buildIndex(records);
      return runSearch(built, tokens, limit);
    },
  };
}

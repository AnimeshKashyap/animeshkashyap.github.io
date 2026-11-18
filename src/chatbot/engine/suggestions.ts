import { CHATBOT_KEYWORDS } from '../config';
import { getRecords } from '../knowledge';
import type { KnowledgeRecord } from '../types';
import { SYNONYMS } from './synonyms';

/** Stable sentence order is the tie-breaker for future autocomplete matching. */
export function buildSuggestionCorpus(
  records: readonly KnowledgeRecord[],
): readonly string[] {
  const sentences = [
    ...CHATBOT_KEYWORDS.map(({ query }) => query),
    'Where can I find his LinkedIn profile?',
    'Where can I find his GitHub profile?',
  ];

  for (const record of records) {
    if (!record.available) {
      continue;
    }
    if (record.type === 'experience') {
      // Experience records expose the company separately from the role title.
      const company = record.text.match(/^Company: (.+)$/m)?.[1]?.trim();
      if (company) {
        sentences.push(
          `What was his role at ${company}?`,
          `Which technologies did he use at ${company}?`,
        );
      }
    } else if (record.type === 'project') {
      sentences.push(`Tell me about his ${record.title} project.`);
    } else if (record.type === 'skill') {
      sentences.push(`What are his skills in ${record.title}?`);
    }
  }

  return [...new Set(sentences)];
}

export const SUGGESTION_CORPUS: readonly string[] = buildSuggestionCorpus(getRecords());

function normalizeSentence(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ').trim();
}

const aliases = Object.entries(SYNONYMS)
  .map(([from, to]) => [normalizeSentence(from), normalizeSentence(to)] as const)
  .sort((a, b) => b[0].length - a[0].length);

function foldSynonyms(text: string): string[] {
  let folded = ` ${text} `;
  for (const [from, to] of aliases) {
    folded = folded.replaceAll(` ${from} `, ` ${to} `);
  }
  return folded.trim().split(/\s+/u);
}

// Build once when this lazy module loads, never on individual keystrokes.
const candidates = [...new Map(SUGGESTION_CORPUS.map((sentence) => [
  normalizeSentence(sentence), sentence,
])).entries()].map(([normalized, sentence]) => ({
  sentence, normalized, words: normalized.split(' '), synonyms: foldSynonyms(normalized),
}));

function matches(tokens: readonly string[], words: readonly string[]): boolean {
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

/** Grounded completions, ranked by literal prefix, word prefixes, then aliases. */
export function suggest(prefix: string, limit = 3): string[] {
  const typed = normalizeSentence(prefix);
  const count = Math.min(3, Math.floor(limit));
  if (typed.replace(/\s/gu, '').length < 2 || !(count > 0)) {
    return [];
  }
  const tokens = typed.split(' ');
  const synonyms = foldSynonyms(typed);
  const ranked: string[][] = [[], [], []];
  for (const candidate of candidates) {
    if (candidate.normalized === typed) {
      continue;
    }
    const rank = candidate.normalized.startsWith(typed) ? 0
      : matches(tokens, candidate.words) ? 1
        : matches(synonyms, candidate.synonyms) ? 2 : -1;
    if (rank >= 0) {
      ranked[rank].push(candidate.sentence);
    }
  }
  return ranked.flat().slice(0, count);
}

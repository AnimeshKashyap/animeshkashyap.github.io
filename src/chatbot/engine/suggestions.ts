import { CHATBOT_KEYWORDS } from '../config';
import { getRecords } from '../knowledge';
import type { KnowledgeRecord } from '../types';

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

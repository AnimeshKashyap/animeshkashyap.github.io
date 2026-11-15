import { CHATBOT_CONFIG } from '../config';
import type { ActionId, KnowledgeRecord, KnowledgeRecordType, Reply } from '../types';
import type { SearchHit } from './search';
import { canonicalize, normalize } from './synonyms';

const MAX_HIGHLIGHTS = 3;
const LOW_CONFIDENCE_TEXT = "I don't have that in the CV.";
const FOLLOW_UP_POOL = CHATBOT_CONFIG.suggestedQuestions;

function fieldValue(text: string, label: string): string | undefined {
  const prefix = `${label}: `;
  for (const line of text.split('\n')) {
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim();
      return value.length > 0 ? value : undefined;
    }
    if (line === `${label}:`) {
      return undefined;
    }
  }
  return undefined;
}

function highlightsFromText(text: string): string[] {
  const marker = 'Highlights:\n';
  const index = text.indexOf(marker);
  if (index === -1) {
    return [];
  }
  return text
    .slice(index + marker.length)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function bulletLines(lines: readonly string[], limit = MAX_HIGHLIGHTS): string[] {
  return lines.slice(0, limit).map((line) => `• ${line}`);
}

function sourceChips(records: readonly KnowledgeRecord[]): Reply['sources'] {
  const seen = new Set<string>();
  const chips: Reply['sources'] = [];
  for (const record of records) {
    if (seen.has(record.id)) {
      continue;
    }
    seen.add(record.id);
    chips.push({ id: record.id, label: record.source });
  }
  return chips;
}

function formatExperience(record: KnowledgeRecord): string {
  const role = fieldValue(record.text, 'Role');
  const company = fieldValue(record.text, 'Company');
  const period = fieldValue(record.text, 'Period');
  const stack = fieldValue(record.text, 'Stack');
  const highlights = bulletLines(highlightsFromText(record.text));

  const headline =
    role !== undefined && company !== undefined
      ? `${role} @ ${company}`
      : record.title;

  const lines = [headline];
  if (period !== undefined) {
    lines.push(`Period: ${period}`);
  }
  if (stack !== undefined) {
    lines.push(`Stack: ${stack}`);
  }
  lines.push(...highlights);
  return lines.join('\n');
}

function formatProject(record: KnowledgeRecord): string {
  const period = fieldValue(record.text, 'Period');
  const stack = fieldValue(record.text, 'Stack');
  const highlights = bulletLines(highlightsFromText(record.text));

  const lines = [record.title];
  if (period !== undefined) {
    lines.push(`Period: ${period}`);
  }
  if (stack !== undefined) {
    lines.push(`Stack: ${stack}`);
  }
  lines.push(...highlights);
  return lines.join('\n');
}

function formatSkill(record: KnowledgeRecord): string {
  const items = record.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const lines = [record.title, ...bulletLines(items, items.length)];
  return lines.join('\n');
}

function formatEducation(record: KnowledgeRecord): string {
  const school = fieldValue(record.text, 'School');
  const degree = fieldValue(record.text, 'Degree');
  const period = fieldValue(record.text, 'Period');
  const detail = fieldValue(record.text, 'Detail');

  if (school === undefined && degree === undefined) {
    return `${record.title}\n${record.text}`;
  }

  const lines: string[] = [];
  if (degree !== undefined && school !== undefined) {
    lines.push(`${degree} — ${school}`);
  } else {
    lines.push(record.title);
  }
  if (period !== undefined) {
    lines.push(`Period: ${period}`);
  }
  const location = fieldValue(record.text, 'Location');
  if (location !== undefined) {
    lines.push(`Location: ${location}`);
  }
  if (detail !== undefined) {
    lines.push(detail);
  }
  return lines.join('\n');
}

function formatFaq(record: KnowledgeRecord): string {
  return `${record.title}\n${record.text}`;
}

function formatUnavailable(record: KnowledgeRecord): string {
  return record.text;
}

function formatProfile(record: KnowledgeRecord): string {
  return record.text;
}

function formatSingleRecord(record: KnowledgeRecord): string {
  switch (record.type) {
    case 'experience':
      return formatExperience(record);
    case 'project':
      return formatProject(record);
    case 'skill':
      return formatSkill(record);
    case 'education':
      return formatEducation(record);
    case 'faq':
      return formatFaq(record);
    case 'unavailable':
      return formatUnavailable(record);
    case 'profile':
      return formatProfile(record);
    default:
      return record.text;
  }
}

function experienceSummary(record: KnowledgeRecord): string {
  const role = fieldValue(record.text, 'Role');
  const company = fieldValue(record.text, 'Company');
  const period = fieldValue(record.text, 'Period');
  const headline =
    role !== undefined && company !== undefined
      ? `${role} @ ${company}`
      : record.title;
  if (period !== undefined) {
    return `${headline} (${period})`;
  }
  return headline;
}

function projectSummary(record: KnowledgeRecord): string {
  const period = fieldValue(record.text, 'Period');
  if (period !== undefined) {
    return `${record.title} (${period})`;
  }
  return record.title;
}

function skillSummary(record: KnowledgeRecord): string {
  const items = record.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (items.length === 0) {
    return record.title;
  }
  return `${record.title}: ${items.join(', ')}`;
}

function educationSummary(record: KnowledgeRecord): string {
  const school = fieldValue(record.text, 'School');
  const degree = fieldValue(record.text, 'Degree');
  if (degree !== undefined && school !== undefined) {
    return `${degree} — ${school}`;
  }
  return record.title;
}

function aggregateLine(record: KnowledgeRecord): string {
  switch (record.type) {
    case 'experience':
      return experienceSummary(record);
    case 'project':
      return projectSummary(record);
    case 'skill':
      return skillSummary(record);
    case 'education':
      return educationSummary(record);
    case 'faq':
    case 'unavailable':
    case 'profile':
      return record.title;
    default:
      return record.title;
  }
}

const AGGREGATE_SECTION_ORDER: KnowledgeRecordType[] = [
  'experience',
  'project',
  'skill',
  'education',
  'profile',
  'faq',
  'unavailable',
];

const SECTION_LABEL: Partial<Record<KnowledgeRecordType, string>> = {
  experience: 'Experience',
  project: 'Projects',
  skill: 'Skills',
  education: 'Education',
};

function formatAggregate(hits: SearchHit[]): string {
  const byType = new Map<KnowledgeRecordType, KnowledgeRecord[]>();
  for (const hit of hits) {
    const group = byType.get(hit.record.type);
    if (group === undefined) {
      byType.set(hit.record.type, [hit.record]);
    } else if (!group.some((item) => item.id === hit.record.id)) {
      group.push(hit.record);
    }
  }

  const blocks: string[] = [];
  const multipleTypes = byType.size > 1;

  for (const type of AGGREGATE_SECTION_ORDER) {
    const records = byType.get(type);
    if (records === undefined || records.length === 0) {
      continue;
    }
    const lines = records.map((record) => `• ${aggregateLine(record)}`);
    if (multipleTypes) {
      const label = SECTION_LABEL[type];
      if (label !== undefined) {
        blocks.push(`${label}:\n${lines.join('\n')}`);
        continue;
      }
    }
    blocks.push(lines.join('\n'));
  }

  return blocks.join('\n\n');
}

function isContactRecord(record: KnowledgeRecord): boolean {
  return (
    record.id === 'faq-contact' ||
    record.id === 'profile-contact' ||
    record.tags.includes('contact')
  );
}

function actionsForRecords(records: readonly KnowledgeRecord[]): ActionId[] {
  const primary = records[0];
  if (primary === undefined) {
    return [];
  }
  if (primary.type === 'unavailable' || isContactRecord(primary)) {
    return ['email'];
  }
  return [];
}

function pickFollowUps(hits: SearchHit[]): string[] {
  const suggestions: string[] = [];
  const records = hits.map((hit) => hit.record);
  const types = new Set(records.map((record) => record.type));

  if (hits.length === 1 && records[0]?.type === 'experience') {
    const company = fieldValue(records[0].text, 'Company');
    if (company !== undefined) {
      suggestions.push(`What technologies did he use at ${company}?`);
    }
  }

  if (types.has('skill') && !types.has('experience')) {
    suggestions.push('Summarize his work experience.');
  }
  if (types.has('experience') && !types.has('project')) {
    suggestions.push('What projects has he built?');
  }
  if (types.has('project') && !types.has('experience')) {
    suggestions.push('Summarize his work experience.');
  }
  if (types.has('education') && types.size === 1) {
    suggestions.push('Which technologies and skills does he focus on?');
  }

  for (const question of FOLLOW_UP_POOL) {
    if (suggestions.length >= 3) {
      break;
    }
    if (!suggestions.includes(question)) {
      suggestions.push(question);
    }
  }

  return suggestions.slice(0, 3);
}

function lowConfidenceReply(): Reply {
  return {
    text: LOW_CONFIDENCE_TEXT,
    sources: [],
    actions: ['email'],
    suggestions: FOLLOW_UP_POOL.slice(0, 3),
    confident: false,
  };
}

function recordTokenSet(record: KnowledgeRecord): Set<string> {
  const tokens = new Set<string>();
  for (const token of canonicalize(record.title)) {
    tokens.add(token);
  }
  for (const token of canonicalize(record.text)) {
    tokens.add(token);
  }
  for (const tag of record.tags) {
    for (const token of canonicalize(tag)) {
      tokens.add(token);
    }
  }
  for (const alias of record.aliases ?? []) {
    for (const token of canonicalize(alias)) {
      tokens.add(token);
    }
  }
  return tokens;
}

function literalQueryTokenOverlap(
  queryTokens: readonly string[],
  record: KnowledgeRecord,
): number {
  const corpus = recordTokenSet(record);
  let overlap = 0;
  for (const token of queryTokens) {
    if (token.length < 3) {
      continue;
    }
    if (corpus.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}

function isConfident(hits: SearchHit[], query: string): boolean {
  const top = hits[0];
  if (top === undefined) {
    return false;
  }
  if (top.score < CHATBOT_CONFIG.retrievalThreshold) {
    return false;
  }
  if (top.score === 1) {
    return true;
  }
  const queryTokens = normalize(query).filter((token) => token.length >= 3);
  if (queryTokens.length <= 1) {
    return true;
  }
  const overlap = literalQueryTokenOverlap(queryTokens, top.record);
  if (overlap >= Math.min(2, queryTokens.length)) {
    return true;
  }
  return overlap >= 1 && top.score >= 0.85;
}

/**
 * Build a retrieval reply from ranked search hits using record text only.
 * Single strong hit → per-type template; multiple hits → concise aggregate list.
 */
export function composeReply(hits: SearchHit[], query: string): Reply {
  if (hits.length === 0 || !isConfident(hits, query)) {
    return lowConfidenceReply();
  }

  const records = hits.map((hit) => hit.record);
  const text =
    hits.length === 1
      ? formatSingleRecord(hits[0]!.record)
      : formatAggregate(hits);

  return {
    text,
    sources: sourceChips(records),
    actions: actionsForRecords(records),
    suggestions: pickFollowUps(hits),
    confident: true,
  };
}
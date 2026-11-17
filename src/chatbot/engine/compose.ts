import { CHATBOT_CONFIG, CHATBOT_KEYWORDS } from '../config';
import type { ActionId, KnowledgeRecord, KnowledgeRecordType, Reply } from '../types';
import type { SearchHit } from './search';
import { canonicalize, normalize } from './synonyms';
import { recordBubbles, replyBubbles } from './bubbles';

const MAX_HIGHLIGHTS = 3;
const LOW_CONFIDENCE_TEXT = "I don't have that in the CV.";
const FOLLOW_UP_POOL = CHATBOT_KEYWORDS.map(({ label }) => label);

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

const PERIOD_RANGE_SPLIT = /\s*[—–-]\s*/u;
const ONGOING_END = /\b(?:present|current|ongoing)\b/ui;

const MONTH_TO_INDEX: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const DATED_AGGREGATE_TYPES: ReadonlySet<KnowledgeRecordType> = new Set([
  'experience',
  'project',
  'education',
]);

function parsePeriodToken(token: string): number | undefined {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (ONGOING_END.test(trimmed)) {
    return Number.MAX_SAFE_INTEGER;
  }
  const monthYear = /^([A-Za-z]{3,})\s+(\d{4})$/u.exec(trimmed);
  if (monthYear !== null) {
    const month = MONTH_TO_INDEX[monthYear[1]!.slice(0, 3).toLowerCase()];
    const year = Number(monthYear[2]);
    if (month !== undefined && Number.isFinite(year)) {
      return year * 100 + month;
    }
  }
  const yearOnly = /^(\d{4})$/u.exec(trimmed);
  if (yearOnly !== null) {
    const year = Number(yearOnly[1]);
    if (Number.isFinite(year)) {
      return year * 100;
    }
  }
  return undefined;
}

function periodSortKey(period: string): { start: number; end: number } | undefined {
  const parts = period.split(PERIOD_RANGE_SPLIT);
  const start = parsePeriodToken(parts[0] ?? '');
  if (start === undefined) {
    return undefined;
  }
  const endRaw = parts.length > 1 ? (parts[1] ?? '').trim() : parts[0] ?? '';
  const end = parsePeriodToken(endRaw) ?? start;
  return { start, end };
}

function compareRecordsByPeriodStart(
  left: KnowledgeRecord,
  right: KnowledgeRecord,
  stableOrder: ReadonlyMap<string, number>,
): number {
  const leftPeriod = fieldValue(left.text, 'Period');
  const rightPeriod = fieldValue(right.text, 'Period');
  const leftKey =
    leftPeriod !== undefined ? periodSortKey(leftPeriod) : undefined;
  const rightKey =
    rightPeriod !== undefined ? periodSortKey(rightPeriod) : undefined;

  if (leftKey === undefined && rightKey === undefined) {
    return (
      (stableOrder.get(left.id) ?? 0) - (stableOrder.get(right.id) ?? 0)
    );
  }
  if (leftKey === undefined) {
    return 1;
  }
  if (rightKey === undefined) {
    return -1;
  }
  if (leftKey.start !== rightKey.start) {
    return rightKey.start - leftKey.start;
  }
  return (stableOrder.get(left.id) ?? 0) - (stableOrder.get(right.id) ?? 0);
}

function stableHitOrder(hits: readonly SearchHit[]): Map<string, number> {
  const order = new Map<string, number>();
  for (let index = 0; index < hits.length; index += 1) {
    const id = hits[index]!.record.id;
    if (!order.has(id)) {
      order.set(id, index);
    }
  }
  return order;
}

function recordsByTypeFromHits(
  hits: readonly SearchHit[],
): Map<KnowledgeRecordType, KnowledgeRecord[]> {
  const byType = new Map<KnowledgeRecordType, KnowledgeRecord[]>();
  for (const hit of hits) {
    const group = byType.get(hit.record.type);
    if (group === undefined) {
      byType.set(hit.record.type, [hit.record]);
    } else if (!group.some((item) => item.id === hit.record.id)) {
      group.push(hit.record);
    }
  }
  return byType;
}

function recordsInAggregateOrder(hits: readonly SearchHit[]): KnowledgeRecord[] {
  const byType = recordsByTypeFromHits(hits);
  const stableOrder = stableHitOrder(hits);
  const ordered: KnowledgeRecord[] = [];

  for (const type of AGGREGATE_SECTION_ORDER) {
    const records = byType.get(type);
    if (records === undefined || records.length === 0) {
      continue;
    }
    const section =
      DATED_AGGREGATE_TYPES.has(type) && records.length > 1
        ? [...records].sort((left, right) =>
            compareRecordsByPeriodStart(left, right, stableOrder),
          )
        : records;
    ordered.push(...section);
  }

  return ordered;
}

function formatAggregate(hits: SearchHit[]): string[] {
  const byType = recordsByTypeFromHits(hits);
  const stableOrder = stableHitOrder(hits);

  const blocks: string[] = [];
  const multipleTypes = byType.size > 1;

  for (const type of AGGREGATE_SECTION_ORDER) {
    const raw = byType.get(type);
    if (raw === undefined || raw.length === 0) {
      continue;
    }
    const records =
      DATED_AGGREGATE_TYPES.has(type) && raw.length > 1
        ? [...raw].sort((left, right) =>
            compareRecordsByPeriodStart(left, right, stableOrder),
          )
        : raw;
    const lines = records.map((record) => `• ${aggregateLine(record)}`);
    if (multipleTypes) {
      const label = SECTION_LABEL[type];
      if (label !== undefined) {
        blocks.push(...lines.map((line, index) => index === 0 ? `${label}:\n${line}` : line));
        continue;
      }
    }
    blocks.push(...lines);
  }

  return replyBubbles(blocks);
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

function pickFollowUps(hits: SearchHit[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  const answered = CHATBOT_KEYWORDS.find(
    ({ label, query: canonical }) =>
      label.toLowerCase() === normalizedQuery || canonical.toLowerCase() === normalizedQuery,
  )?.label;
  const primary = hits[0]?.record;
  const topic = answered ?? (primary?.type === 'experience' ? 'Experience'
    : primary?.type === 'skill' ? 'Skills'
    : primary?.type === 'project' ? 'Projects'
    : primary?.type === 'education' ? 'Education'
    : primary?.id === 'profile-summary' ? 'Profile Summary'
    : primary !== undefined && isContactRecord(primary) ? 'Contact' : undefined);
  const contextual = topic === 'Experience'
    ? ['Skills', 'Projects', 'Total Experience']
    : topic === 'Skills' || topic === 'Projects'
      ? ['Experience', 'Skills', 'Projects', 'Education']
      : ['Experience', 'Skills', 'Projects', 'Contact'];
  return [...new Set([...contextual, ...FOLLOW_UP_POOL])]
    .filter((label) => label !== topic)
    .slice(0, 4);
}

function lowConfidenceReply(query: string): Reply {
  const bubbles = [LOW_CONFIDENCE_TEXT];
  return {
    bubbles,
    text: bubbles.join('\n\n'),
    sources: [],
    actions: ['email'],
    suggestions: pickFollowUps([], query),
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
    return lowConfidenceReply(query);
  }

  const records =
    hits.length === 1
      ? hits.map((hit) => hit.record)
      : recordsInAggregateOrder(hits);
  const bubbles =
    hits.length === 1
      ? recordBubbles(formatSingleRecord(hits[0]!.record))
      : formatAggregate(hits);

  return {
    bubbles,
    text: bubbles.join('\n\n'),
    sources: sourceChips(records),
    actions: actionsForRecords(records),
    suggestions: pickFollowUps(hits, query),
    confident: true,
  };
}
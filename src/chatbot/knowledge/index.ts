import type { KnowledgeRecord } from '../types';
import { buildRecords } from './buildRecords';
import extrasJson from './extras.json';

export interface RecordsValidationResult {
  ok: boolean;
  errors: string[];
}

let memoizedRecords: KnowledgeRecord[] | undefined;

function isKnowledgeRecord(value: unknown): value is KnowledgeRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.type === 'string' &&
    typeof record.title === 'string' &&
    typeof record.text === 'string' &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === 'string') &&
    typeof record.source === 'string' &&
    typeof record.available === 'boolean'
  );
}

function loadExtrasRecords(): KnowledgeRecord[] {
  if (!Array.isArray(extrasJson)) {
    throw new Error('extras.json must contain a JSON array of knowledge records');
  }
  const records: KnowledgeRecord[] = [];
  for (const entry of extrasJson) {
    if (!isKnowledgeRecord(entry)) {
      throw new Error('extras.json contains an entry that does not match KnowledgeRecord');
    }
    records.push(entry);
  }
  return records;
}

export function getRecords(): KnowledgeRecord[] {
  if (memoizedRecords === undefined) {
    memoizedRecords = [...buildRecords(), ...loadExtrasRecords()];
  }
  return memoizedRecords;
}

export function validateRecords(records: KnowledgeRecord[]): RecordsValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    if (seenIds.has(record.id)) {
      errors.push(`duplicate id: ${record.id}`);
    } else {
      seenIds.add(record.id);
    }

    if (record.title.trim().length === 0) {
      errors.push(`empty title for id: ${record.id}`);
    }

    if (record.text.trim().length === 0) {
      errors.push(`empty text for id: ${record.id}`);
    }

    for (const tag of record.tags) {
      if (tag !== tag.toLowerCase()) {
        errors.push(`tag not lowercase for id ${record.id}: ${tag}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

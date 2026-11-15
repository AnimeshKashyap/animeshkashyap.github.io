import { describe, it, expect } from 'vitest';
import { composeReply } from './compose';
import { createEngine } from './engine';
import { createSearcher } from './search';
import { getRecords } from '../knowledge';
import type { KnowledgeRecord } from '../types';
import type { SearchHit } from './search';

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

/** Catalog order from `buildRecords()` — experience data is newest role first. */
function experienceRecordsChronology(): KnowledgeRecord[] {
  return getRecords().filter((record) => record.type === 'experience');
}

function companyFromBullet(line: string): string | undefined {
  const match = /^•\s+.+ @ (.+?) \(/u.exec(line);
  return match?.[1];
}

function companiesFromAggregateText(text: string): string[] {
  return text
  .split('\n')
    .map((line) => companyFromBullet(line))
    .filter((company): company is string => company !== undefined);
}

function searchHitsInRetrievalOrder(records: readonly KnowledgeRecord[]): SearchHit[] {
  return [...records].reverse().map((record, index) => ({
    record,
    score: 1 - index * 0.01,
  }));
}

function experienceHit(
  id: string,
  company: string,
  period: string,
  score: number,
): SearchHit {
  return {
    record: {
      id,
      type: 'experience',
      title: `Engineer — ${company}`,
      text: `Role: Engineer\nCompany: ${company}\nPeriod: ${period}`,
      tags: ['experience'],
      source: `Experience: ${company}`,
      available: true,
    },
    score,
  };
}

const AGGREGATE_EXPERIENCE_QUERY = 'Summarize his work experience.';

/** Newest-first by `Period` start (catalog array order is not chronological). */
const PROJECT_NEWEST_FIRST_TITLES: string[] = [
  'YouTube Automation for Game Tournament Highlights',
  'DOTA 2 Custom Bot',
  'Choice-based User Flow Implementation',
  'Real-Time Chat Application',
  'Android Game Development',
  'C++ Game Development (Win32)',
];

function projectRecordsChronology(): KnowledgeRecord[] {
  const byTitle = new Map(
    getRecords()
      .filter((record) => record.type === 'project')
      .map((record) => [record.title, record] as const),
  );
  return PROJECT_NEWEST_FIRST_TITLES.map((title) => {
    const record = byTitle.get(title);
    expect(record).toBeDefined();
    return record!;
  });
}

function titleFromProjectBullet(line: string): string | undefined {
  const match =
    /^•\s+(.+?) \((?:[A-Za-z]{3,9}\s+\d{4}\s*[—–-])/u.exec(line);
  return match?.[1];
}

function titlesFromProjectAggregate(text: string): string[] {
  return text
    .split('\n')
    .map((line) => titleFromProjectBullet(line))
    .filter((title): title is string => title !== undefined);
}

function projectHit(
  id: string,
  title: string,
  period: string,
  score: number,
): SearchHit {
  return {
    record: {
      id,
      type: 'project',
      title,
      text: `Period: ${period}`,
      tags: ['project'],
      source: `Project: ${title}`,
      available: true,
    },
    score,
  };
}

const AGGREGATE_PROJECT_QUERY = 'Summarize his personal projects.';

describe('composeReply aggregate project chronology', () => {
  it('lists project bullets and source chips newest-first (not retrieval-score order)', () => {
    const chronology = projectRecordsChronology();
    expect(chronology.length).toBeGreaterThan(1);

    const hits = searchHitsInRetrievalOrder(chronology);
    const reply = composeReply(hits, AGGREGATE_PROJECT_QUERY);

    expect(reply.confident).toBe(true);
    const expectedSources = chronology.map((record) => record.source);
    expect(reply.sources.map((chip) => chip.label)).toEqual(expectedSources);

    const titlesInText = titlesFromProjectAggregate(reply.text);
    expect(titlesInText).toEqual(chronology.map((record) => record.title));
  });

  it('engine aggregate project reply matches chronology for retrieved projects', async () => {
    const engine = createEngine();
    const query = 'game development';
    const reply = await engine.ask(query);

    const chronology = projectRecordsChronology();
    const searcher = createSearcher(getRecords());
    const hits = searcher.search(query, { limit: 50 });
    const retrievedIds = new Set(
      hits.filter((hit) => hit.record.type === 'project').map((hit) => hit.record.id),
    );

    const expectedOrder = chronology
      .filter((record) => retrievedIds.has(record.id))
      .map((record) => record.source);

    expect(reply.confident).toBe(true);
    const projectChips = reply.sources.filter((chip) => chip.id.startsWith('proj-'));
    expect(projectChips.map((chip) => chip.label)).toEqual(expectedOrder);
    expect(titlesFromProjectAggregate(reply.text)).toEqual(
      expectedOrder.map((source) => source.replace(/^Project: /u, '')),
    );
  });

  it('ranks project bullets and chips by period when hits arrive oldest-first', () => {
    const hits = [
      projectHit('proj-old', 'C++ Game (Win32)', 'Feb 2014 — Mar 2014', 0.99),
      projectHit('proj-new', 'YouTube Highlights Bot', 'Mar 2024 — Present', 0.98),
      projectHit('proj-mid', 'DOTA Bot', 'Jun 2021 — Ongoing', 0.97),
    ];
    const reply = composeReply(hits, 'game development');
    expect(reply.confident).toBe(true);
    const titles = titlesFromProjectAggregate(reply.text);
    expect(titles).toEqual([
      'YouTube Highlights Bot',
      'DOTA Bot',
      'C++ Game (Win32)',
    ]);
    expect(reply.sources.map((chip) => chip.label)).toEqual([
      'Project: YouTube Highlights Bot',
      'Project: DOTA Bot',
      'Project: C++ Game (Win32)',
    ]);
  });
});

describe('composeReply aggregate experience chronology', () => {
  it('lists experience bullets and source chips newest-first (not retrieval-score order)', () => {
    const chronology = experienceRecordsChronology();
    expect(chronology.length).toBeGreaterThan(1);

    const hits = searchHitsInRetrievalOrder(chronology);
    const reply = composeReply(hits, 'Summarize his work experience.');

    expect(reply.confident).toBe(true);
    const expectedSources = chronology.map((record) => record.source);
    expect(reply.sources.map((chip) => chip.label)).toEqual(expectedSources);

    const companiesInText = companiesFromAggregateText(reply.text);
    const expectedCompanies = chronology.map(
      (record) => fieldValue(record.text, 'Company') ?? record.title,
    );
    expect(companiesInText).toEqual(expectedCompanies);
  });

  it('engine aggregate experience reply matches chronology for retrieved roles', async () => {
    const engine = createEngine();
    const reply = await engine.ask('Summarize his work experience.');

    const chronology = experienceRecordsChronology();
    const searcher = createSearcher(getRecords());
    const hits = searcher.search('Summarize his work experience.');
    const retrievedIds = hits.map((hit) => hit.record.id);

    const expectedOrder = chronology
      .filter((record) => retrievedIds.includes(record.id))
      .map((record) => record.source);

    expect(reply.sources.map((chip) => chip.label)).toEqual(expectedOrder);
    expect(companiesFromAggregateText(reply.text)).toEqual(
      expectedOrder.map((source) => source.replace(/^Experience: /u, '')),
    );
  });

  it('ranks Present and Current end dates ahead of closed roles', () => {
    const hits = [
      experienceHit('exp-closed', 'Closed Co', 'Jan 2019 — Dec 2019', 0.99),
      experienceHit('exp-present', 'Present Co', 'Jan 2020 — Present', 0.98),
      experienceHit('exp-current', 'Current Co', 'Jun 2021 — Current', 0.97),
    ];
    const reply = composeReply(hits, AGGREGATE_EXPERIENCE_QUERY);
    const companies = companiesFromAggregateText(reply.text);
    expect(companies).toEqual(['Current Co', 'Present Co', 'Closed Co']);
    expect(reply.sources.map((chip) => chip.label)).toEqual([
      'Experience: Current Co',
      'Experience: Present Co',
      'Experience: Closed Co',
    ]);
  });

  it('keeps retrieval order when experience start dates tie', () => {
    const hits = [
      experienceHit('exp-first', 'Alpha Corp', 'Jan 2022 — Jun 2022', 0.99),
      experienceHit('exp-second', 'Beta Corp', 'Jan 2022 — Dec 2022', 0.98),
    ];
    const reply = composeReply(hits, AGGREGATE_EXPERIENCE_QUERY);
    const companies = companiesFromAggregateText(reply.text);
    expect(companies).toEqual(['Alpha Corp', 'Beta Corp']);
    expect(reply.sources.map((chip) => chip.id)).toEqual(['exp-first', 'exp-second']);
  });

  it('does not reorder skill records without Period', () => {
    const skillHit = (
      id: string,
      title: string,
      score: number,
    ): SearchHit => ({
      record: {
        id,
        type: 'skill',
        title,
        text: 'Item A\nItem B',
        tags: [],
        source: `Skills: ${title}`,
        available: true,
      },
      score,
    });
    const hits = [
      skillHit('skill-z', 'Backend', 1),
      skillHit('skill-a', 'Frontend', 0.99),
    ];
    const reply = composeReply(hits, 'Which technologies and skills does he focus on?');
    expect(reply.sources.map((chip) => chip.id)).toEqual(['skill-z', 'skill-a']);
    expect(reply.text).toMatch(/^• Backend:/u);
    expect(reply.text).toMatch(/\n• Frontend:/u);
  });
});
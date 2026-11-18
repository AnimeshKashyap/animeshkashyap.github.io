import { afterEach, describe, expect, it, vi } from 'vitest';
import { profile } from '../../data/profile';
import { skillGroups } from '../../data/skills';
import { buildRecords } from './buildRecords';
import { validateRecords } from './index';

function faq(date = '2026-11-15T12:00:00Z') {
  return buildRecords(new Date(date)).find((record) => record.id === 'faq-total-experience')!;
}

afterEach(() => vi.restoreAllMocks());

describe('total-experience knowledge', () => {
  it.each([
    ['2026-11-15', '8 years 7 months'],
    ['2026-04-01', '8 years'],
    ['2019-05-01', '1 year 1 month'],
    ['2018-05-01', '1 month'],
    ['2018-06-01', '2 months'],
    ['2018-12-31', '8 months'],
    ['2019-01-01', '9 months'],
    ['2019-03-31', '11 months'],
    ['2019-04-01', '1 year'],
    ['2018-04-01', '0 months'],
    ['2017-04-01', '0 months'],
  ])('formats the month-granular duration at %s', (date, duration) => {
    expect(faq(`${date}T12:00:00Z`).text).toBe(
      `${profile.name} has ${duration} of experience across Python, Node.js, React.js, AWS, architecture design.`,
    );
  });

  it('provides a concise, valid FAQ with the requested aliases and tags', () => {
    const record = faq();
    expect(record.type).toBe('faq');
    expect(record.available).toBe(true);
    expect(record.source).not.toBe('');
    expect(record.text.length).toBeLessThanOrEqual(400);
    expect(record.text).not.toMatch(/Wish A Design|breaks|estimate|2017|8\+/);
    expect(record.tags).toEqual([
      'total experience', 'years of experience', 'how long',
      'how experienced', 'career length', 'seniority',
    ]);
    expect(record.aliases).toEqual(['how long', 'career length', 'seniority']);
    expect(validateRecords(buildRecords(new Date('2026-11-15T12:00:00Z')))).toEqual({ ok: true, errors: [] });
  });

  it('derives supported technologies and architecture from current site data', () => {
    expect(profile.summary).toContain('AWS');
    const items = skillGroups.flatMap((group) => group.items);
    for (const skill of ['Python', 'Node.js', 'React.js', 'System Design']) {
      expect(items).toContain(skill);
    }
    expect(faq().text).toContain('Python, Node.js, React.js, AWS, architecture design');
  });

  it('omits all claims when neither profile nor skills supports them', () => {
    vi.spyOn(profile, 'summary', 'get').mockReturnValue('Software engineer.');
    vi.spyOn(skillGroups, 'flatMap').mockReturnValue(['Pythonic', 'ReactXjs', 'AWSome', 'Design Patterns']);
    expect(faq().text).toBe(`${profile.name} has 8 years 7 months of experience.`);
  });

  it('omits unsupported individual skills while retaining supported claims', () => {
    vi.spyOn(skillGroups, 'flatMap').mockReturnValue(['Python', 'System Design', 'NodeXjs']);
    vi.spyOn(profile, 'summary', 'get').mockReturnValue('Experience with AWS.');
    expect(faq().text).toBe(`${profile.name} has 8 years 7 months of experience across Python, AWS, architecture design.`);
  });

  it('uses the current date when no date is injected', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2027-04-01T12:00:00Z'));
      expect(buildRecords().find((record) => record.id === 'faq-total-experience')!.text).toContain('9 years of experience');
    } finally {
      vi.useRealTimers();
    }
  });

  it('can derive technologies from profile alone and omit unsupported architecture', () => {
    vi.spyOn(skillGroups, 'flatMap').mockReturnValue([]);
    vi.spyOn(profile, 'summary', 'get').mockReturnValue('Python, Node.js, React.js and AWS.');
    expect(faq().text).toBe(`${profile.name} has 8 years 7 months of experience across Python, Node.js, React.js, AWS.`);
  });
});

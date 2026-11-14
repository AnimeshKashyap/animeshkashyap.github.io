import { awards, education, languages } from '../../data/education';
import { experience } from '../../data/experience';
import { profile } from '../../data/profile';
import { projects } from '../../data/projects';
import { skillGroups } from '../../data/skills';
import type { KnowledgeRecord } from '../types';

function slug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'item';
}

function uniqueId(prefix: string, label: string, used: Set<string>): string {
  const base = `${prefix}-${slug(label)}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function tagsFrom(values: readonly string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = value.toLowerCase();
    if (seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

function joinLines(lines: Array<string | undefined>): string {
  return lines.filter((line): line is string => line !== undefined).join('\n');
}

function aliasesFrom(values: Array<string | undefined>): string[] | undefined {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values) {
    if (value === undefined || value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    aliases.push(value);
  }
  return aliases.length > 0 ? aliases : undefined;
}

function withAliases(record: KnowledgeRecord, aliases: string[] | undefined): KnowledgeRecord {
  if (aliases === undefined) {
    return record;
  }
  return { ...record, aliases };
}

function profileRecords(used: Set<string>): KnowledgeRecord[] {
  used.add('profile-summary');
  used.add('profile-contact');

  const summary = withAliases(
    {
      id: 'profile-summary',
      type: 'profile',
      title: `${profile.name} — ${profile.title}`,
      text: joinLines([
        profile.name,
        profile.title,
        profile.location,
        profile.summary,
        ...profile.stats.map((stat) => `${stat.label}: ${stat.value}`),
      ]),
      tags: [],
      source: 'Profile: Summary',
      available: true,
    },
    aliasesFrom([profile.name, profile.title]),
  );

  const contact = withAliases(
    {
      id: 'profile-contact',
      type: 'profile',
      title: 'Contact',
      text: joinLines([
        `Email: ${profile.email}`,
        ...profile.phones.map((phone) => `Phone: ${phone}`),
        ...profile.links.map((link) => `${link.label}: ${link.url}`),
        `Resume: ${profile.resumeFile}`,
      ]),
      tags: [],
      source: 'Profile: Contact',
      available: true,
    },
    aliasesFrom([profile.email, ...profile.phones, ...profile.links.map((link) => link.label)]),
  );

  return [summary, contact];
}

function experienceRecords(used: Set<string>): KnowledgeRecord[] {
  return experience.map((entry) => {
    const stackLine =
      entry.stack !== undefined && entry.stack.length > 0
        ? `Stack: ${entry.stack.join(', ')}`
        : undefined;
    const highlightLine =
      entry.highlights.length > 0 ? `Highlights:\n${entry.highlights.join('\n')}` : undefined;

    return withAliases(
      {
        id: uniqueId('exp', entry.company, used),
        type: 'experience',
        title: `${entry.role} — ${entry.company}`,
        text: joinLines([
          `Role: ${entry.role}`,
          `Company: ${entry.company}`,
          entry.client !== undefined ? `Client: ${entry.client}` : undefined,
          `Period: ${entry.period}`,
          `Location: ${entry.location}`,
          stackLine,
          highlightLine,
        ]),
        tags: tagsFrom(entry.stack),
        source: `Experience: ${entry.company}`,
        available: true,
      },
      aliasesFrom([entry.role, entry.company, entry.client]),
    );
  });
}

function projectRecords(used: Set<string>): KnowledgeRecord[] {
  return projects.map((project) => {
    const highlightLine =
      project.highlights.length > 0 ? `Highlights:\n${project.highlights.join('\n')}` : undefined;

    return {
      id: uniqueId('proj', project.title, used),
      type: 'project',
      title: project.title,
      text: joinLines([
        `Period: ${project.period}`,
        project.stack.length > 0 ? `Stack: ${project.stack.join(', ')}` : undefined,
        highlightLine,
      ]),
      tags: tagsFrom(project.stack),
      source: `Project: ${project.title}`,
      available: true,
    };
  });
}

function skillRecords(used: Set<string>): KnowledgeRecord[] {
  return skillGroups.map((group) => ({
    id: uniqueId('skill', group.category, used),
    type: 'skill',
    title: group.category,
    text: group.items.join('\n'),
    tags: tagsFrom(group.items),
    source: `Skills: ${group.category}`,
    available: true,
  }));
}

function educationRecords(used: Set<string>): KnowledgeRecord[] {
  const entries = education.map((entry) =>
    withAliases(
      {
        id: uniqueId('edu', entry.school, used),
        type: 'education',
        title: `${entry.degree} — ${entry.school}`,
        text: joinLines([
          `School: ${entry.school}`,
          `Degree: ${entry.degree}`,
          `Period: ${entry.period}`,
          `Location: ${entry.location}`,
          `Detail: ${entry.detail}`,
        ]),
        tags: [],
        source: `Education: ${entry.school}`,
        available: true,
      },
      aliasesFrom([entry.school, entry.degree]),
    ),
  );

  const awardsRecord: KnowledgeRecord = {
    id: uniqueId('edu', 'awards', used),
    type: 'education',
    title: 'Awards and certifications',
    text: awards.join('\n'),
    tags: [],
    source: 'Education: Awards and certifications',
    available: true,
  };

  const languagesRecord: KnowledgeRecord = {
    id: uniqueId('edu', 'languages', used),
    type: 'education',
    title: 'Languages',
    text: languages.map((language) => `${language.name}: ${language.level}`).join('\n'),
    tags: [],
    source: 'Education: Languages',
    available: true,
  };

  return [...entries, awardsRecord, languagesRecord];
}

export function buildRecords(): KnowledgeRecord[] {
  const used = new Set<string>();
  return [
    ...profileRecords(used),
    ...experienceRecords(used),
    ...projectRecords(used),
    ...skillRecords(used),
    ...educationRecords(used),
  ];
}

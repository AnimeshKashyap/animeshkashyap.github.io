/**
 * Alias map applied during retrieval.
 * Technical aliases (py, js, aws terms, …) fold index text and queries.
 * Category aliases (work → experience, tech → skills) apply to queries only,
 * so body words like "Stack:" are not rewritten in the index.
 */
export const SYNONYMS: Readonly<Record<string, string>> = {
  'c++': 'cpp',
  'c#': 'csharp',
  py: 'python',
  py3: 'python',
  python3: 'python',
  js: 'javascript',
  ts: 'typescript',
  nodejs: 'node',
  'node.js': 'node',
  'node js': 'node',
  reactjs: 'react',
  'react.js': 'react',
  'react js': 'react',
  nestjs: 'nest',
  'nest.js': 'nest',
  'nest js': 'nest',
  jestjs: 'jest',
  'jest.js': 'jest',
  'jest js': 'jest',
  nextjs: 'next',
  'next.js': 'next',
  'next js': 'next',
  vuejs: 'vue',
  'vue.js': 'vue',
  'vue js': 'vue',
  ml: 'ai',
  machinelearning: 'ai',
  'machine learning': 'ai',
  artificialintelligence: 'ai',
  'artificial intelligence': 'ai',
  'amazon web services': 'aws',
  'elastic compute cloud': 'ec2',
  'simple storage service': 's3',
  'simple queue service': 'sqs',
  'step functions': 'stepfunctions',
  postgres: 'postgresql',
  psql: 'postgresql',
  mongo: 'mongodb',
  dynamo: 'dynamodb',
  k8s: 'kubernetes',
  gcloud: 'gcp',
  'google cloud': 'gcp',
  'ms sql': 'mssql',
  'ci cd': 'cicd',
  'ci/cd': 'cicd',
  'fast api': 'fastapi',
  resume: 'cv',
  résumé: 'cv',
  'curriculum vitae': 'cv',
  'work authorization': 'workauthorization',
  'notice period': 'noticeperiod',
  'right to work': 'righttowork',
  'work visa': 'workvisa',
  'work permit': 'workpermit',
  work: 'experience',
  job: 'experience',
  jobs: 'experience',
  career: 'experience',
  careers: 'experience',
  employment: 'experience',
  'work experience': 'experience',
  tech: 'skills',
  stack: 'skills',
  technology: 'skills',
  technologies: 'skills',
  skill: 'skills',
  'tech stack': 'skills',
  'full stack': 'skills',
  'full-stack': 'skills',
  project: 'projects',
  college: 'education',
  university: 'education',
  school: 'education',
  degree: 'education',
};

/** Tag tokens rolled into an `aws` query so AWS service names aggregate together. */
export const AWS_TERMS: readonly string[] = [
  'aws',
  'amazon',
  'ec2',
  's3',
  'sqs',
  'lambda',
  'dynamodb',
  'eventbridge',
  'athena',
  'ecs',
  'stepfunctions',
  'sns',
  'iam',
  'vpc',
  'cloudwatch',
];

const QUERY_ONLY_ALIASES: ReadonlySet<string> = new Set([
  'work',
  'job',
  'jobs',
  'career',
  'careers',
  'employment',
  'work experience',
  'tech',
  'stack',
  'technology',
  'technologies',
  'skill',
  'tech stack',
  'full stack',
  'full-stack',
  'project',
  'college',
  'university',
  'school',
  'degree',
]);

const STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'then',
  'else',
  'when',
  'while',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'at',
  'by',
  'from',
  'as',
  'into',
  'over',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'am',
  'do',
  'does',
  'did',
  'doing',
  'has',
  'have',
  'had',
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'where',
  'why',
  'how',
  'can',
  'could',
  'should',
  'would',
  'will',
  'shall',
  'may',
  'might',
  'i',
  'me',
  'my',
  'mine',
  'we',
  'our',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
  'this',
  'that',
  'these',
  'those',
  'there',
  'here',
  'about',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'any',
  'some',
  'such',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'also',
  'please',
  'tell',
  'describe',
  'explain',
  'summarize',
  'summary',
  'show',
  'list',
  'give',
  'get',
  'using',
  'use',
  'used',
  'via',
  'it',
  'its',
]);

const PHRASES: readonly (readonly [string, string])[] = Object.entries(SYNONYMS)
  .filter(([key]) => /[^a-z0-9]/u.test(key))
  .sort((left, right) => right[0].length - left[0].length);

function applyPhrases(value: string, query: boolean): string {
  let result = ` ${value} `;
  for (const [from, to] of PHRASES) {
    if (!query && QUERY_ONLY_ALIASES.has(from)) {
      continue;
    }
    const needle = ` ${from} `;
    if (result.includes(needle)) {
      result = result.replaceAll(needle, ` ${to} `);
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

function mapToken(token: string, query: boolean): string {
  const mapped = SYNONYMS[token];
  if (mapped === undefined) {
    return token;
  }
  if (!query && QUERY_ONLY_ALIASES.has(token)) {
    return token;
  }
  return mapped;
}

function normalizeText(text: string, query: boolean): string[] {
  const lowered = text.toLowerCase().replace(/['’]s\b/gu, '').replace(/['’]/gu, '');
  const phrased = applyPhrases(lowered, query);
  const unfolded = phrased.normalize('NFD').replace(/\p{M}/gu, '');
  const stripped = unfolded.replace(/[^a-z0-9]+/gu, ' ').trim();
  const tokens = applyPhrases(stripped, query).split(/\s+/u);
  const normalized: string[] = [];

  for (const token of tokens) {
    if (token.length === 0 || STOPWORDS.has(token)) {
      continue;
    }
    const mapped = mapToken(token, query);
    if (mapped.length === 0 || STOPWORDS.has(mapped)) {
      continue;
    }
    if (normalized[normalized.length - 1] !== mapped) {
      normalized.push(mapped);
    }
  }

  return normalized;
}

/** Index form: lowercase, strip punctuation and stopwords, fold technical aliases. */
export function canonicalize(text: string): string[] {
  return normalizeText(text, false);
}

/** Query form: {@link canonicalize} plus category aliases such as work → experience. */
export function normalize(text: string): string[] {
  return normalizeText(text, true);
}

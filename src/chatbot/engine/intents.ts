import { CHATBOT_CONFIG } from '../config';
import type { ActionId, Reply } from '../types';

function normalizeIntentQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9\s@#+/._'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function intentReply(text: string, actions: ActionId[]): Reply {
  return {
    text,
    sources: [],
    actions,
    suggestions: [...CHATBOT_CONFIG.suggestedQuestions],
    confident: true,
  };
}

const PURE_GREETING =
  /^(?:hi|hello|hey|howdy|greetings|good (?:morning|afternoon|evening)|yo)(?:[!.,?]*\s*)$/;

const HELP =
  /\b(?:what can you do|what do you do|how can you help|what are you|what questions|help me|(?:^|\s)help(?:\s|$)|capabilities)\b/;

const CV =
  /\b(?:resume|resumé|résumé|curriculum vitae|\bcv\b|download (?:the |his |your )?(?:resume|cv|résumé))\b/;

const EMAIL =
  /\b(?:e-?mail|email (?:him|animesh)?|contact(?:\s+him)?|reach out|get in touch|send (?:an )?e?-?mail)\b/;

const LINKEDIN = /\blinked\s*in\b/;

const GITHUB = /\bgit\s*hub\b/;

function isProjectsNavigation(query: string): boolean {
  if (/^(?:projects|portfolio)$/.test(query)) {
    return true;
  }
  if (/\b(?:view|show|see|go to|open|navigate(?:\s+to)?|scroll(?:\s+to)?)\s+(?:the\s+)?(?:projects|portfolio)\b/.test(query)) {
    return true;
  }
  return /\b(?:projects|portfolio)\s+section\b/.test(query);
}

type IntentMatcher = {
  matches: (query: string) => boolean;
  reply: () => Reply;
};

const INTENT_RULES: IntentMatcher[] = [
  {
    matches: (query) => LINKEDIN.test(query),
    reply: () =>
      intentReply('You can open Animesh\'s LinkedIn profile using the button below.', ['linkedin']),
  },
  {
    matches: (query) => GITHUB.test(query),
    reply: () => intentReply('You can open Animesh\'s GitHub profile using the button below.', ['github']),
  },
  {
    matches: (query) => CV.test(query) && EMAIL.test(query),
    reply: () =>
      intentReply(
        'You can email Animesh or download his résumé using the buttons below.',
        ['email', 'cv'],
      ),
  },
  {
    matches: (query) => CV.test(query),
    reply: () =>
      intentReply('You can download Animesh\'s résumé using the button below.', ['cv']),
  },
  {
    matches: (query) => EMAIL.test(query),
    reply: () => intentReply('I can open an email to Animesh for you.', ['email']),
  },
  {
    matches: (query) => isProjectsNavigation(query),
    reply: () =>
      intentReply('I can take you to the projects section of the portfolio.', ['projects']),
  },
  {
    matches: (query) => HELP.test(query),
    reply: () =>
      intentReply(
        'I answer questions about Animesh\'s experience, skills, projects, and education from his portfolio data. You can also ask me to open links, email him, or download his résumé.',
        [],
      ),
  },
  {
    matches: (query) => PURE_GREETING.test(query),
    reply: () => intentReply(CHATBOT_CONFIG.greeting, []),
  },
];

/** Deterministic intent routing — returns a full reply when matched, otherwise `null` (fall through to retrieval). */
export function resolveIntent(query: string): Reply | null {
  const normalized = normalizeIntentQuery(query);
  if (normalized.length === 0) {
    return null;
  }

  for (const rule of INTENT_RULES) {
    if (rule.matches(normalized)) {
      return rule.reply();
    }
  }

  return null;
}
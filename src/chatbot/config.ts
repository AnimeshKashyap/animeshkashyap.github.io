import { profile } from '../data/profile';
import type { ActionId } from './types';

type ActionKind = 'open' | 'download' | 'mailto' | 'scroll';

interface ChatAction {
  label: string;
  kind: ActionKind;
  url: string;
}

function profileLinkUrl(label: string): string {
  const link = profile.links.find((item) => item.label === label);
  if (link === undefined) {
    throw new Error(`Profile link not found: ${label}`);
  }
  return link.url;
}

/** Minimum retrieval score for returning knowledge-backed answers. */
export const CHATBOT_RETRIEVAL_THRESHOLD = 0.35;

export const CHATBOT_CONFIG = {
  greeting:
    "Hi — I'm the portfolio assistant for Animesh Kashyap. Ask about his experience, skills, projects, education, or how to get in touch.",
  suggestedQuestions: [
    "What is Animesh's professional background?",
    'Which technologies and skills does he focus on?',
    'Summarize his work experience.',
    'What projects has he built?',
    'How can I contact him or download his résumé?',
  ],
  retrievalThreshold: CHATBOT_RETRIEVAL_THRESHOLD,
  actions: {
    cv: {
      label: 'Download résumé',
      kind: 'download',
      url: profile.resumeFile,
    },
    email: {
      label: 'Email Animesh',
      kind: 'mailto',
      url: `mailto:${profile.email}`,
    },
    linkedin: {
      label: 'LinkedIn',
      kind: 'open',
      url: profileLinkUrl('LinkedIn'),
    },
    github: {
      label: 'GitHub',
      kind: 'open',
      url: profileLinkUrl('GitHub'),
    },
    projects: {
      label: 'View projects',
      kind: 'scroll',
      url: `${import.meta.env.BASE_URL}#projects`,
    },
  } satisfies Record<ActionId, ChatAction>,
};

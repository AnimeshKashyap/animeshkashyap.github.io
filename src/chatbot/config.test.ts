import { describe, expect, it } from 'vitest';
import { CHATBOT_KEYWORDS } from './config';
import { createEngine } from './engine/engine';
import { getRecords } from './knowledge';

const engine = createEngine();
const recordsById = new Map(getRecords().map((record) => [record.id, record]));

const expectedTargets = [
  { label: 'Experience', sourceType: 'experience' },
  { label: 'Total Experience', sourceId: 'faq-total-experience' },
  { label: 'Skills', sourceType: 'skill' },
  { label: 'Profile Summary', sourceId: 'profile-summary' },
  { label: 'Projects', sourceId: 'faq-projects' },
  { label: 'Education', sourceType: 'education' },
  { label: 'Contact', action: 'email' },
  { label: 'Download Resume', action: 'cv' },
];

describe('CHATBOT_KEYWORDS', () => {
  it('defines all eight unique keyword labels and canonical questions', () => {
    expect(CHATBOT_KEYWORDS.map(({ label }) => label)).toEqual(
      expectedTargets.map(({ label }) => label),
    );
    expect(new Set(CHATBOT_KEYWORDS.map(({ query }) => query)).size).toBe(8);
    expect(CHATBOT_KEYWORDS.every(({ query }) => query.trim().length > 0)).toBe(true);
  });

  it.each(expectedTargets)('$label resolves confidently to its intended topic or action', async (target) => {
    const keyword = CHATBOT_KEYWORDS.find(({ label }) => label === target.label);
    expect(keyword).toBeDefined();
    const reply = await engine.ask(keyword!.query);

    expect(reply.confident).toBe(true);
    expect(reply.text.trim().length).toBeGreaterThan(0);
    if (target.action !== undefined) {
      expect(reply.actions).toContain(target.action);
    }
    if (target.sourceId !== undefined) {
      expect(reply.sources.map(({ id }) => id)).toContain(target.sourceId);
    }
    if (target.sourceType !== undefined) {
      expect(reply.sources.some(({ id }) => recordsById.get(id)?.type === target.sourceType)).toBe(true);
    }
  });
});

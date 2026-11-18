import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';

describe('education reply', () => {
  it('shows complete degree details only, without awards or languages', async () => {
    const reply = await (await createEngine()).ask('What is his education?');
    const bubbles = reply.bubbles ?? [reply.text];
    const text = bubbles.join('\n');
    expect(text).toContain('(2013 — 2017), Greater Noida, India — 65.1% Aggregate');
    expect(text).toContain('D.A.V. Public School (CBSE) (2011 — 2013), Delhi, India');
    expect(text).not.toContain('D.A.V.\nPublic');
    expect(text).not.toContain('Awards');
    expect(text).not.toContain('Languages');
    expect(reply.sources.map((source) => source.id)).not.toContain('edu-awards');
    expect(reply.sources.map((source) => source.id)).not.toContain('edu-languages');
  });

  it.each(['What awards and certifications does he have?', 'awards and certifications', 'certifications'])(
    'answers "%s" with the first bullet under the heading, then one bubble per bullet',
    async (query) => {
      const reply = await (await createEngine()).ask(query);
      const bubbles = reply.bubbles ?? [reply.text];
      expect(bubbles[0]).toMatch(/^Awards and certifications:\n• Solved 500\+/u);
      expect(bubbles.slice(1)).toEqual([
        expect.stringMatching(/^• Consistently qualified/u),
        expect.stringMatching(/^• Actively competed/u),
        expect.stringMatching(/^• Completed Computer Science/u),
      ]);
      expect(reply.sources.map((source) => source.id)).toEqual(['edu-awards']);
    },
  );
});

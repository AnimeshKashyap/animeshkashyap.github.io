import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';

describe('education reply', () => {
  it('shows complete degree, period, location, score, and awards, without languages', async () => {
    const reply = await (await createEngine()).ask('What is his education?');
    const bubbles = reply.bubbles ?? [reply.text];
    const text = bubbles.join('\n');
    expect(text).toContain('(2013 — 2017), Greater Noida, India — 65.1% Aggregate');
    expect(text).toContain('D.A.V. Public School (CBSE) (2011 — 2013), Delhi, India');
    expect(text).toContain('Awards and certifications:');
    expect(text).toContain('Solved 500+ coding problems');
    expect(text).not.toContain('Languages');
    expect(reply.sources.some((source) => source.id === 'edu-languages')).toBe(false);
    // Awards: heading with the first bullet, then one bubble per remaining bullet.
    const start = bubbles.findIndex((bubble) => bubble.startsWith('Awards and certifications:'));
    expect(bubbles[start]).toMatch(/^Awards and certifications:\n• Solved 500\+/u);
    expect(bubbles.slice(start + 1)).toEqual([
      expect.stringMatching(/^• Consistently qualified/u),
      expect.stringMatching(/^• Actively competed/u),
      expect.stringMatching(/^• Completed Computer Science/u),
    ]);
    expect(text).not.toContain('D.A.V.\nPublic');
  });
});

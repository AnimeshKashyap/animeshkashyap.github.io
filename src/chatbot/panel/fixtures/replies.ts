import type { ActionId, Reply } from '../../types';

export function makeReply(overrides: Partial<Reply> = {}): Reply {
  const bubbles = overrides.bubbles ?? [overrides.text ?? 'Sample answer line one.\n• Bullet item\nSecond paragraph.'];
  return {
    sources: [{ id: 'profile-main', label: 'Profile' }],
    actions: ['linkedin'] as ActionId[],
    suggestions: ['Follow up question?'],
    confident: true,
    ...overrides,
    bubbles,
    text: bubbles.join('\n\n'),
  };
}

export const hostileMarkupText =
  '<img src=x onerror="alert(1)"><script>alert("xss")</script>&lt;safe&gt;';
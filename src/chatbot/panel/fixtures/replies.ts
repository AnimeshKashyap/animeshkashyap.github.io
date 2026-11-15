import type { ActionId, Reply } from '../../types';

export function makeReply(overrides: Partial<Reply> = {}): Reply {
  return {
    text: 'Sample answer line one.\n• Bullet item\nSecond paragraph.',
    sources: [{ id: 'profile-main', label: 'Profile' }],
    actions: ['linkedin'] as ActionId[],
    suggestions: ['Follow up question?'],
    confident: true,
    ...overrides,
  };
}

export const hostileMarkupText =
  '<img src=x onerror="alert(1)"><script>alert("xss")</script>&lt;safe&gt;';
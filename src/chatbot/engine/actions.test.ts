import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHATBOT_CONFIG } from '../config';
import { runAction } from './actions';

describe('cv download action', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saves the resume under a friendly file name', () => {
    const anchor = { href: '', rel: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
    runAction('cv', { page: 'main' });
    expect(anchor.href).toBe(CHATBOT_CONFIG.actions.cv.url);
    expect(anchor.download).toBe('Animesh Kashyap - CV.pdf');
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});

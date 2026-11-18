import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_QUERY } from './compact';
import { installBrowserGlobals, type BrowserGlobalsHandle } from './panel/fixtures/browser-globals';

const openPanel = vi.fn();
vi.mock('./launcher', () => ({ mountLauncher: vi.fn() }));
vi.mock('./panel/panel', () => ({ openPanel: (options?: unknown) => openPanel(options) }));

describe('mountChatbot default open', () => {
  let browser: BrowserGlobalsHandle;
  let classes: Set<string>;

  beforeEach(() => {
    browser = installBrowserGlobals();
    classes = new Set(['chatbot-booting']);
    Object.assign(document, {
      documentElement: {
        classList: {
          contains: (name: string) => classes.has(name),
          remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
        },
      },
    });
    openPanel.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    browser.reset();
  });

  it.each([
    [true, 1],
    [false, 0],
  ])('compact=%s opens the panel %i time(s), without focusing the input', async (compact, calls) => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: compact } as MediaQueryList);
    const { mountChatbot } = await import('./index');
    mountChatbot({ page: 'main' });
    await vi.waitFor(() => expect(openPanel).toHaveBeenCalledTimes(calls));
    if (calls > 0) expect(openPanel).toHaveBeenCalledWith({ focus: false, fade: true });
  });

  it('releases the compact page cover after the chat has faded in', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const { mountChatbot } = await import('./index');
    mountChatbot({ page: 'main' });
    await vi.advanceTimersByTimeAsync(0);
    expect(openPanel).toHaveBeenCalled();
    expect(classes.has('chatbot-booting')).toBe(true);
    await vi.advanceTimersByTimeAsync(349);
    expect(classes.has('chatbot-booting')).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(classes.has('chatbot-booting')).toBe(false);
    vi.useRealTimers();
  });

  it.each(['../../index.html', '../../v4/index.html'])('%s shows the cover for the same compact query', (file) => {
    const html = readFileSync(new URL(file, import.meta.url), 'utf8');
    expect(html).toContain(`window.matchMedia('${COMPACT_QUERY}')`);
    expect(html).toContain("root.classList.add('chatbot-booting')");
    expect(html).toContain('html.chatbot-booting::before');
  });
});


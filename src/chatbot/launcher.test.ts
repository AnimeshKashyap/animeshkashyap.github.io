import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHATBOT_CONFIG } from './config';
import { buildLauncherStyles, mountLauncher } from './launcher';
import { togglePanel } from './panel/panel';
import {
  installBrowserGlobals,
  type BrowserGlobalsHandle,
  type MockElement,
  type MockShadowRoot,
} from './panel/fixtures/browser-globals';

const LAUNCHER_BUBBLE_SESSION_KEY = 'portfolio-chatbot-launcher-bubble-seen';
const LAUNCHER_BUBBLE_AUTO_HIDE_MS = 8000;

vi.mock('./panel/panel', () => ({
  togglePanel: vi.fn(),
}));

function mountLauncherOnPage(page: 'main' | 'v4'): {
  host: MockElement;
  launcher: MockElement;
  shadow: MockShadowRoot;
} {
  const host = document.createElement('div') as unknown as MockElement;
  (document.body as unknown as MockElement).appendChild(host);
  const launcher = mountLauncher(host as unknown as HTMLElement, page) as unknown as MockElement;
  const shadow = host.shadowRoot;
  if (shadow === null) {
    throw new Error('expected open shadow root');
  }
  return { host, launcher, shadow };
}

function getBubble(shadow: MockShadowRoot): MockElement | null {
  return shadow.querySelector('.launcher-bubble');
}

describe('buildLauncherStyles', () => {
  it('main page :host does not pin dark theme tokens so site tokens can inherit', () => {
    const styles = buildLauncherStyles('main');
    const hostBlock = styles.slice(0, styles.indexOf('.launcher-wrap'));

    expect(hostBlock).toContain('all: initial');
    expect(hostBlock).not.toMatch(/--bg-raised:\s*#/);
    expect(hostBlock).not.toMatch(/--text-primary:\s*#/);
    expect(hostBlock).not.toMatch(/--accent-cyan:\s*#/);
    expect(styles).toContain('var(--text-primary, #eef1f8)');
    expect(styles).toContain('var(--bg-raised, #0b0f1a)');
  });

  it('v4 page :host keeps scoped navy palette tokens', () => {
    const styles = buildLauncherStyles('v4');
    const hostBlock = styles.slice(0, styles.indexOf('.launcher-wrap'));

    expect(hostBlock).toContain('color-scheme: dark');
    expect(hostBlock).toContain('--bg-raised: #10131f');
    expect(hostBlock).toContain('--accent-cyan: #3b82f6');
    expect(hostBlock).toContain('--accent-violet: #60a5fa');
  });

  it('uses token fallbacks and viewport-safe bubble width for collision avoidance', () => {
    const styles = buildLauncherStyles('main');

    expect(styles).toContain('var(--shadow-card,');
    expect(styles).toContain('var(--radius-md,');
    expect(styles).toContain('calc(100vw - 32px');
    expect(styles).toContain('env(safe-area-inset-left');
    expect(styles).toContain('env(safe-area-inset-right');
  });

  it('disables launcher and bubble motion when prefers-reduced-motion is reduce', () => {
    const styles = buildLauncherStyles('main');

    expect(styles).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
    expect(styles).toContain('.launcher {\n    animation: none;');
    expect(styles).toContain('.launcher-bubble {\n    transition: none;');
  });
});

describe('mountLauncher greeting bubble', () => {
  let browser: BrowserGlobalsHandle;

  beforeEach(() => {
    browser = installBrowserGlobals();
    vi.mocked(togglePanel).mockClear();
  });

  afterEach(() => {
    browser.reset();
    vi.useRealTimers();
  });

  it('does not mount a bubble when the session flag is already set', () => {
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');

    const { shadow } = mountLauncherOnPage('main');

    expect(getBubble(shadow)).toBeNull();
  });

  it('shows an accessible bubble on first mount and records seen immediately', () => {
    const { shadow } = mountLauncherOnPage('main');
    const bubble = getBubble(shadow);

    expect(bubble).not.toBeNull();
    expect(bubble?.getAttribute('role')).toBe('status');
    expect(bubble?.getAttribute('aria-live')).toBe('polite');
    expect(shadow.querySelector('.launcher-bubble__text')?.textContent).toBe(
      CHATBOT_CONFIG.launcherBubbleText,
    );
    expect(shadow.querySelector('.launcher-bubble__dismiss')?.getAttribute('aria-label')).toBe(
      'Dismiss assistant hint',
    );
    expect(browser.sessionData.get(LAUNCHER_BUBBLE_SESSION_KEY)).toBe('1');
  });

  it('shows the same bubble on v4 first mount', () => {
    const { shadow, launcher } = mountLauncherOnPage('v4');

    expect(getBubble(shadow)).not.toBeNull();
    expect(launcher.getAttribute('aria-label')).toBe('Open chat');
  });

  it('does not show a bubble on v4 when the session flag exists', () => {
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');

    const { shadow } = mountLauncherOnPage('v4');

    expect(getBubble(shadow)).toBeNull();
  });

  it('hides the bubble when dismiss is clicked', () => {
    const { shadow } = mountLauncherOnPage('main');
    const bubble = getBubble(shadow);
    expect(bubble?.hasAttribute('hidden')).toBe(false);

    shadow.querySelector('.launcher-bubble__dismiss')?.click();

    expect(bubble?.hasAttribute('hidden')).toBe(true);
    expect(browser.sessionData.get(LAUNCHER_BUBBLE_SESSION_KEY)).toBe('1');
  });

  it('hides the bubble when the launcher is clicked', async () => {
    const { launcher, shadow } = mountLauncherOnPage('main');
    const bubble = getBubble(shadow);

    launcher.click();

    expect(bubble?.hasAttribute('hidden')).toBe(true);
    await vi.waitFor(() => {
      expect(togglePanel).toHaveBeenCalledTimes(1);
    });
  });

  it('calls togglePanel once when the launcher is clicked and no bubble is shown', async () => {
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');

    const { launcher } = mountLauncherOnPage('main');
    launcher.click();

    await vi.waitFor(() => {
      expect(togglePanel).toHaveBeenCalledTimes(1);
    });
  });

  it('auto-hides the bubble after the configured timeout', () => {
    vi.useFakeTimers();
    const { shadow } = mountLauncherOnPage('main');
    const bubble = getBubble(shadow);

    vi.advanceTimersByTime(LAUNCHER_BUBBLE_AUTO_HIDE_MS - 1);
    expect(bubble?.hasAttribute('hidden')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(bubble?.hasAttribute('hidden')).toBe(true);
  });

  it('skips the bubble when sessionStorage read throws', () => {
    const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
    sessionStorage.getItem = () => {
      throw new Error('sessionStorage denied');
    };

    const { shadow } = mountLauncherOnPage('main');

    expect(getBubble(shadow)).toBeNull();

    sessionStorage.getItem = originalGetItem;
  });

  it('still mounts the bubble when sessionStorage.setItem throws while marking seen', () => {
    const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
    sessionStorage.setItem = (key: string, value: string) => {
      if (key === LAUNCHER_BUBBLE_SESSION_KEY) {
        throw new Error('quota exceeded');
      }
      originalSetItem(key, value);
    };

    const { shadow } = mountLauncherOnPage('main');

    expect(getBubble(shadow)).not.toBeNull();
    expect(browser.sessionData.has(LAUNCHER_BUBBLE_SESSION_KEY)).toBe(false);

    sessionStorage.setItem = originalSetItem;
  });

  it('does not show the bubble again on a second mount in the same session after first visit', () => {
    const first = mountLauncherOnPage('main');
    expect(getBubble(first.shadow)).not.toBeNull();

    const secondHost = document.createElement('div') as unknown as MockElement;
    (document.body as unknown as MockElement).appendChild(secondHost);
    mountLauncher(secondHost as unknown as HTMLElement, 'main');

    const secondShadow = secondHost.shadowRoot;
    if (secondShadow === null) {
      throw new Error('expected open shadow root');
    }
    expect(getBubble(secondShadow)).toBeNull();
  });
});
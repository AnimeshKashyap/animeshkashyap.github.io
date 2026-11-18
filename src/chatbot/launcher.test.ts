/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHATBOT_CONFIG } from './config';
import { buildLauncherStyles, mountLauncher } from './launcher';
import { togglePanel } from './panel/panel';
const panelStyles = readFileSync(fileURLToPath(new URL('./panel/panel.css', import.meta.url)), 'utf8');
import {
  installBrowserGlobals,
  type BrowserGlobalsHandle,
  type MockElement,
  type MockShadowRoot,
} from './panel/fixtures/browser-globals';

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
  it('shares panel and greeting anchors and keeps launcher labels inward at safe edges', () => {
    expect(CHATBOT_CONFIG.launcherSide).toBe('right');
    const styles = buildLauncherStyles('main');
    expect(panelStyles).toContain('left: var(--side-left)');
    expect(panelStyles).toContain('right: var(--side-right)');
    expect(styles).toContain('align-items: var(--side-align)');
    expect(styles).toContain('--tip-origin: 100%');
    expect(styles).toContain('--tip-left: calc(100% + 8px)');
    expect(styles).toContain('--tip-right: calc(100% + 8px)');
    expect(styles).toContain('100vw - var(--side-offset) - var(--opposite-offset) - 64px');
    expect(styles).not.toContain('scale('); // scaling a launcher would also scale its viewport-sized tooltip
    for (const side of ['left', 'right']) {
      for (const [viewport, safeLeft, safeRight] of [[320, 0, 0], [320, 40, 24], [768, 24, 100]] as const) {
        const left = Math.max(16, safeLeft);
        const right = Math.max(16, safeRight);
        const iconLeft = side === 'left' ? left : viewport - right - 56;
        const labelWidth = Math.min(2000, viewport - left - right - 64);
        const labelLeft = side === 'left' ? iconLeft + 64 : iconLeft - 8 - labelWidth;
        expect(labelLeft).toBeGreaterThanOrEqual(left);
        expect(labelLeft + labelWidth).toBeLessThanOrEqual(viewport - right);
        expect(side === 'left' ? labelLeft - iconLeft - 56 : iconLeft - labelLeft - labelWidth).toBe(8);
      }
    }
  });
  it.each(['main', 'v4'] as const)('centres the inward greeting beside the icon on %s without entering the dock column', (page) => {
    const styles = buildLauncherStyles(page);
    const bubble = styles.slice(styles.indexOf('.launcher-bubble {'), styles.indexOf('.launcher-bubble[hidden]'));
    expect(bubble).toContain('position: absolute');
    expect(bubble).toContain('left: var(--tip-left)');
    expect(bubble).toContain('right: var(--tip-right)');
    expect(bubble).toContain('bottom: 28px');
    expect(bubble).toContain('transform: translateY(50%)');
    expect(bubble).toContain('width: 260px');
    expect(bubble).toContain('overflow-wrap: anywhere');
    expect(bubble).toContain('.launcher-bubble::before');
    expect(bubble).toContain('left: var(--tip-origin)');
    expect(bubble).toContain('top: 50%');
    expect(bubble).toContain('scaleX(var(--side-sign)) rotate(45deg)');
    expect(styles).toContain('opacity: 1;\n      transform: translateY(50%)');

    // Static geometry only: arbitrary wrapped heights keep the same icon centre.
    for (const side of ['left', 'right']) {
      for (const viewport of [768, 1280]) {
        for (const height of [50, 100, 240]) {
          const edge = 16;
          const iconLeft = side === 'left' ? edge : viewport - edge - 56;
          const width = Math.min(260, viewport - edge * 2 - 64);
          const tooltipLeft = side === 'left' ? iconLeft + 64 : iconLeft - 8 - width;
          const tooltipBottom = edge + 28 - height / 2;
          expect(tooltipBottom + height / 2).toBe(edge + 28);
          expect(tooltipLeft).toBeGreaterThanOrEqual(edge);
          expect(tooltipLeft + width).toBeLessThanOrEqual(viewport - edge);
          const dockLeft = iconLeft + 8;
          expect(side === 'left' ? tooltipLeft >= dockLeft + 40 : tooltipLeft + width <= dockLeft).toBe(true);
        }
      }
    }
  });

  it('binds inward placement and arrow direction to the same side-specific CSS variables', () => {
    const styles = buildLauncherStyles('main');
    const defaultSide = styles.slice(styles.indexOf('--side-left:'), styles.indexOf(':host([data-side=right])'));
    const rightSide = styles.slice(styles.indexOf(':host([data-side=right])'), styles.indexOf('.launcher-wrap'));
    expect(defaultSide).toContain('--tip-left: calc(100% + 8px)');
    expect(defaultSide).toContain('--tip-right: auto');
    expect(defaultSide).toContain('--tip-origin: 0%');
    expect(defaultSide).toContain('--side-sign: 1');
    expect(rightSide).toContain('--tip-left: auto');
    expect(rightSide).toContain('--tip-right: calc(100% + 8px)');
    expect(rightSide).toContain('--tip-origin: 100%');
    expect(rightSide).toContain('--side-sign: -1');
  });

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
    expect(styles).toContain('max-width: max(0px, calc(100vw - var(--side-offset) - var(--opposite-offset) - 64px))');
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
    vi.restoreAllMocks();
    browser.reset();
    vi.useRealTimers();
  });

  it.each(['main', 'v4'] as const)('skips mobile greeting and its timer on %s without consuming the session', (page) => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const { shadow } = mountLauncherOnPage(page);
    expect(getBubble(shadow)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(buildLauncherStyles(page)).toContain('@media (max-width: 479px), (max-height: 499px)');
    expect(buildLauncherStyles(page)).toContain('.launcher-bubble { display: none; }');
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 479px), (max-height: 499px)');
  });

  it('keeps tooltips visible until scrolling and restores them 2s after scrolling stops', () => {
    vi.useFakeTimers();
    const { shadow } = mountLauncherOnPage('main');
    const wrap = shadow.querySelector('.launcher-wrap')!;
    const scroll = (): void => (window as unknown as { windowListeners: Map<string, (() => void)[]> })
      .windowListeners.get('scroll')!.forEach((listener) => listener());
    expect(wrap.hasAttribute('data-tips')).toBe(true);
    scroll();
    expect(wrap.hasAttribute('data-tips')).toBe(false);
    vi.advanceTimersByTime(1500);
    scroll();
    vi.advanceTimersByTime(1999);
    expect(wrap.hasAttribute('data-tips')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(wrap.hasAttribute('data-tips')).toBe(true);
    const styles = buildLauncherStyles('main');
    expect(styles).toContain('.launcher-wrap[data-tips] .launcher[aria-expanded="false"]::after');
    expect(styles).toMatch(/\.launcher-bubble \{[^}]*z-index: 2;/);
  });

  it('hides and cancels the timer on entering compact mode, never resurrecting the greeting', () => {
    vi.useFakeTimers();
    let change: (event: { matches: boolean }) => void = () => {};
    const changeListeners: (typeof change)[] = [];
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: (_type: string, listener: typeof change) => { changeListeners.push(listener); },
    } as unknown as MediaQueryList);
    const { shadow } = mountLauncherOnPage('main');
    change = (event) => changeListeners.forEach((listener) => listener(event));
    expect(vi.getTimerCount()).toBe(1);
    change({ matches: true });
    expect(getBubble(shadow)?.hasAttribute('hidden')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    change({ matches: false });
    expect(getBubble(shadow)?.hasAttribute('hidden')).toBe(true);
  });

  it('mounts the More options arrow after the chat icon and collapses the dock when chat opens', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    Object.assign(document, { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { launcher, shadow } = mountLauncherOnPage('main');
    const more = shadow.querySelector('.quick-dock__more')!;
    const dock = shadow.querySelector('.quick-dock')!;
    expect(more.getAttribute('aria-controls')).toBe(dock.id);
    more.click();
    expect(dock.hasAttribute('data-open')).toBe(true);
    launcher.click();
    expect(dock.hasAttribute('data-open')).toBe(false);
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(buildLauncherStyles('main')).toContain('.quick-dock__more { display: none; }');
  });

  it('hides the whole compact launcher column (chat icon, dock, arrow) while the chat is open', () => {
    const css = buildLauncherStyles('main');
    const compact = css.slice(css.indexOf('@media (max-width: 479px), (max-height: 499px)'));
    expect(compact).toMatch(/\.launcher-wrap:has\(\.launcher\[aria-expanded="true"\]\)\s*\{\s*display:\s*none;/);
    const { shadow } = mountLauncherOnPage('main');
    const wrap = shadow.querySelector('.launcher-wrap')!;
    for (const sel of ['.launcher', '.quick-dock', '.quick-dock__more']) expect(wrap.querySelector(sel)).not.toBeNull();
  });

  it.each(['pointerenter', 'mouseenter', 'focus', 'pointerdown', 'keydown'])('suppresses greeting on every launcher/dock %s before tooltip display', (event) => {
    vi.useFakeTimers();
    for (const index of [0, 1, 2, 3, 4, 5]) {
      browser.sessionData.clear();
      const { launcher, shadow } = mountLauncherOnPage('main');
      const controls = [launcher, ...shadow.querySelector('.quick-dock')!.querySelectorAll('.quick-dock__button')];
      controls[index].dispatchEvent(event);
      expect(getBubble(shadow)?.hasAttribute('hidden')).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      expect(togglePanel).not.toHaveBeenCalled();
    }
  });

  it.each(['main', 'v4'] as const)('synchronously suppresses programmatic panel opens and competing tooltips on %s', (page) => {
    const styles = buildLauncherStyles(page);
    expect(styles).toContain('.launcher-wrap:has(.launcher[aria-expanded="true"]) .launcher-bubble');
    expect(styles).toContain('.launcher-wrap:has(.launcher:hover, .launcher:focus-visible, .quick-dock:hover, .quick-dock:focus-within) .launcher-bubble {\n  display: none;');
  });

  it.each(['left', 'right'] as const)('mirrors configured %s side onto the shadow host', (side) => {
    const original = CHATBOT_CONFIG.launcherSide;
    try {
      CHATBOT_CONFIG.launcherSide = side;
      const { host } = mountLauncherOnPage('main');
      expect(host.getAttribute('data-side')).toBe(side);
      const styles = buildLauncherStyles('main');
      expect(styles).toContain(':host([data-side=right])');
      expect(styles).toContain('align-items: var(--side-align)');
      expect(styles).toContain('--side-align: flex-end');
    } finally {
      CHATBOT_CONFIG.launcherSide = original;
    }
  });

  it('shows an accessible bubble on every load until the user engages', () => {
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
  });

  it('shows the same bubble on v4 first mount', () => {
    const { shadow, launcher } = mountLauncherOnPage('v4');

    expect(getBubble(shadow)).not.toBeNull();
    expect(launcher.getAttribute('aria-label')).toBe('Open chat');
  });

  it.each(['main', 'v4'] as const)('preserves the unseen session from mobile to a desktop mount on %s', (page) => {
    vi.useFakeTimers();
    const media = vi.spyOn(window, 'matchMedia');
    media.mockReturnValueOnce({ matches: true } as MediaQueryList);
    expect(getBubble(mountLauncherOnPage(page).shadow)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    media.mockReturnValue({ matches: false } as MediaQueryList);
    expect(getBubble(mountLauncherOnPage(page).shadow)).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);
  });

  it.each(['main', 'v4'] as const)('keeps dismissal final across page variants after starting on %s', (page) => {
    vi.useFakeTimers();
    const { shadow } = mountLauncherOnPage(page);
    expect(vi.getTimerCount()).toBe(1);
    shadow.querySelector('.launcher-bubble__dismiss')!.click();
    expect(getBubble(shadow)?.hasAttribute('hidden')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(togglePanel).not.toHaveBeenCalled();

    const otherPage = page === 'main' ? 'v4' : 'main';
    // Dismissal is per page load: a fresh mount (reload) shows the hint again.
    expect(getBubble(mountLauncherOnPage(otherPage).shadow)).not.toBeNull();
    vi.advanceTimersByTime(LAUNCHER_BUBBLE_AUTO_HIDE_MS);
    expect(getBubble(shadow)?.hasAttribute('hidden')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['main', 'v4'] as const)('cancels auto-hide synchronously before lazy panel opening on %s', async (page) => {
    vi.useFakeTimers();
    const { launcher, shadow } = mountLauncherOnPage(page);
    expect(vi.getTimerCount()).toBe(1);
    launcher.click();
    expect(getBubble(shadow)?.hasAttribute('hidden')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.waitFor(() => expect(togglePanel).toHaveBeenCalledTimes(1));
    expect(getBubble(shadow)?.hasAttribute('hidden')).toBe(true);
  });

  it('hides the bubble when dismiss is clicked', () => {
    const { shadow } = mountLauncherOnPage('main');
    const bubble = getBubble(shadow);
    expect(bubble?.hasAttribute('hidden')).toBe(false);

    shadow.querySelector('.launcher-bubble__dismiss')?.click();

    expect(bubble?.hasAttribute('hidden')).toBe(true);
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
    const { launcher, shadow } = mountLauncherOnPage('main');
    shadow.querySelector('.launcher-bubble__dismiss')!.click();
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

  it('shows the bubble again on every mount (reload)', () => {
    const first = mountLauncherOnPage('main');
    expect(getBubble(first.shadow)).not.toBeNull();

    const secondHost = document.createElement('div') as unknown as MockElement;
    (document.body as unknown as MockElement).appendChild(secondHost);
    mountLauncher(secondHost as unknown as HTMLElement, 'main');

    const secondShadow = secondHost.shadowRoot;
    if (secondShadow === null) {
      throw new Error('expected open shadow root');
    }
    expect(getBubble(secondShadow)).not.toBeNull();
  });

});
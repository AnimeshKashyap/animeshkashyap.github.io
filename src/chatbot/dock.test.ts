import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_QUERY } from './compact';
import { createDock, dockStyles, mountMoreToggle } from './dock';
import { runAction } from './engine/actions';
import { installBrowserGlobals, type BrowserGlobalsHandle, type MockElement } from './panel/fixtures/browser-globals';

vi.mock('./engine/actions', () => ({ runAction: vi.fn() }));

describe('quick action dock', () => {
  let browser: BrowserGlobalsHandle;
  beforeEach(() => { browser = installBrowserGlobals(); vi.mocked(runAction).mockClear(); });
  afterEach(() => browser.reset());

  it.each(['main', 'v4'] as const)('creates labelled SVG buttons and dispatches actions on %s', async (page) => {
    const dock = createDock(page) as unknown as MockElement;
    const buttons = dock.querySelectorAll('.quick-dock__button');
    const expected = [['cv', 'Download resume'], ['email', 'Email Animesh'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['projects', 'View projects']];
    expect(buttons).toHaveLength(expected.length);
    expect(runAction).not.toHaveBeenCalled();
    for (const [index, [id, label]] of expected.entries()) {
      const button = buttons[index]!;
      expect(button.getAttribute('data-action')).toBe(id);
      expect(button.getAttribute('aria-label')).toBe(label);
      expect(button.getAttribute('data-tooltip')).toBe(label);
      expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(button.querySelector('path')?.getAttribute('d')).toBeTruthy();
      button.click();
      await vi.waitFor(() => expect(runAction).toHaveBeenCalledWith(id, { page }));
    }
    expect(runAction).toHaveBeenCalledTimes(5);
  });

  it('keeps action IDs and page context separate for rapid clicks across docks', async () => {
    const main = createDock('main') as unknown as MockElement;
    const v4 = createDock('v4') as unknown as MockElement;
    const mainButtons = main.querySelectorAll('.quick-dock__button');
    const v4Buttons = v4.querySelectorAll('.quick-dock__button');

    mainButtons[4]!.click();
    v4Buttons[0]!.click();
    mainButtons[4]!.click();
    v4Buttons[4]!.click();

    await vi.waitFor(() => expect(runAction).toHaveBeenCalledTimes(4));
    expect(vi.mocked(runAction).mock.calls).toEqual([
      ['projects', { page: 'main' }],
      ['cv', { page: 'v4' }],
      ['projects', { page: 'main' }],
      ['projects', { page: 'v4' }],
    ]);
  });

  it('places closed labels inward without crossing the icon or safe edges', () => {
    expect(dockStyles).toContain('left: var(--tip-left); right: var(--tip-right); top: 50%');
    expect(dockStyles).toContain('transform: translateY(-50%)');
    expect(dockStyles).toContain('box-sizing: border-box; width: max-content');
    expect(dockStyles).toContain('100vw - var(--side-offset) - var(--opposite-offset) - 56px');
    expect(dockStyles).toContain('overflow-wrap: anywhere');
    for (const side of ['left', 'right']) {
      for (const [viewport, safeLeft, safeRight, naturalWidth] of [
        [320, 0, 0, 150], [320, 40, 24, 500], [768, 100, 32, 1000], [1280, 24, 90, 2000],
      ] as const) {
        const left = Math.max(16, safeLeft);
        const right = Math.max(16, safeRight);
        const edge = side === 'left' ? left : viewport - right;
        const iconLeft = side === 'left' ? edge + 8 : edge - 48;
        expect(iconLeft + 20).toBe(side === 'left' ? edge + 28 : edge - 28);
        const width = Math.min(naturalWidth, viewport - left - right - 56);
        const labelLeft = side === 'left' ? iconLeft + 48 : iconLeft - 8 - width;
        expect(labelLeft).toBeGreaterThanOrEqual(left);
        expect(labelLeft + width).toBeLessThanOrEqual(viewport - right);
        expect(side === 'left' ? labelLeft - iconLeft - 40 : iconLeft - labelLeft - width).toBe(8);
        for (let index = 0; index < 5; index++) {
          const sign = side === 'left' ? 1 : -1;
          const rowIcon = side === 'left' ? edge + index * 46 : edge - 40 - index * 46;
          const rowWidth = Math.min(naturalWidth, viewport - left - right);
          const rowLeft = rowIcon + (side === 'right' ? 40 : 0) - sign * index * 46 - (side === 'right' ? rowWidth : 0);
          expect(rowLeft).toBeGreaterThanOrEqual(left);
          expect(rowLeft + rowWidth).toBeLessThanOrEqual(viewport - right);
          // Above placement separates even multi-line labels from their own icon.
          const iconTop = 100;
          expect(iconTop - 8).toBeLessThan(iconTop);
        }
      }
    }
    expect(dockStyles).toContain('var(--tip-origin) - var(--side-sign) * var(--index) * 46px');
    expect(dockStyles).toContain('top: auto; bottom: calc(100% + 8px)');
    expect(dockStyles).toContain(':focus-visible::after');
  });

  it('centers the closed buttons with the 56px launcher', () => {
    expect(dockStyles).toContain('left: var(--side-left); right: var(--side-right)');
    expect(dockStyles).toContain('width: 40px; height: 40px');
    expect(8 + 40 + 8).toBe(56);
  });

  it('moves the dock and buttons with transforms and honors reduced motion', () => {
    expect(dockStyles).toContain('.launcher[aria-expanded="true"] ~ .quick-dock');
    expect(dockStyles).toContain('transform: translate(calc(var(--side-sign) * var(--dock-x, 8px)), var(--dock-y, 0px))');
    expect(dockStyles).toContain('transition: transform 240ms ease');
    expect(dockStyles).not.toMatch(/transition:\s*[^;]*(?:left|bottom)/);
    expect(dockStyles).toContain('translateY(calc(var(--index) * -46px))');
    expect(dockStyles).toContain('translateX(calc(var(--side-sign) * var(--index) * 46px))');
    expect(dockStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(dockStyles).toContain('.quick-dock, .quick-dock__button { transition: none; }');
    expect(dockStyles).not.toContain('top: calc(100% + 8px); bottom: auto');
    expect(dockStyles).toContain('.quick-dock__button::after { transition: none; }');
  });

  describe('compact more-options toggle', () => {
    let docListeners: Map<string, Set<(e: unknown) => void>>;
    const setup = (compact = true) => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: compact } as MediaQueryList);
      docListeners = new Map();
      Object.assign(document, {
        addEventListener: (t: string, l: (e: unknown) => void) => {
          docListeners.set(t, (docListeners.get(t) ?? new Set()).add(l));
        },
        removeEventListener: (t: string, l: (e: unknown) => void) => { docListeners.get(t)?.delete(l); },
      });
      const wrap = document.createElement('div') as unknown as MockElement;
      const dock = createDock('main') as unknown as MockElement;
      wrap.appendChild(dock);
      mountMoreToggle(wrap as unknown as HTMLElement, dock as unknown as HTMLElement);
      const more = wrap.querySelector('.quick-dock__more')!;
      return { dock, more };
    };
    const fire = (type: string, event: object) => { for (const l of [...(docListeners.get(type) ?? [])]) l(event); };
    afterEach(() => vi.restoreAllMocks());

    it('resets the dock on breakpoint flips and leaves no document listeners', () => {
      const changes = new Set<() => void>();
      const mq = { matches: true, addEventListener: (_: string, l: () => void) => changes.add(l) };
      const flip = (matches: boolean) => { mq.matches = matches; for (const l of changes) l(); };
      const { dock, more } = setup();
      vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
      const wrap = document.createElement('div') as unknown as MockElement;
      const d = createDock('main') as unknown as MockElement;
      wrap.appendChild(d);
      mountMoreToggle(wrap as unknown as HTMLElement, d as unknown as HTMLElement);
      const arrow = wrap.querySelector('.quick-dock__more')!;
      arrow.click();
      expect(d.hasAttribute('data-open')).toBe(true);
      flip(false);
      expect(d.hasAttribute('data-open')).toBe(false);
      expect(arrow.getAttribute('aria-expanded')).toBe('false');
      expect(d.hasAttribute('inert')).toBe(false);
      expect(d.hasAttribute('aria-hidden')).toBe(false);
      for (const b of d.querySelectorAll('.quick-dock__button')) expect(b.hasAttribute('tabindex')).toBe(false);
      expect(docListeners.get('pointerdown')?.size ?? 0).toBe(0);
      expect(docListeners.get('keydown')?.size ?? 0).toBe(0);
      flip(true);
      expect(d.hasAttribute('data-open')).toBe(false);
      expect(d.hasAttribute('inert')).toBe(true);
      expect(d.getAttribute('aria-hidden')).toBe('true');
      for (const b of d.querySelectorAll('.quick-dock__button')) expect(b.getAttribute('tabindex')).toBe('-1');
      expect(dock).toBeDefined();
      expect(more).toBeDefined();
    });

    it('follows the real compact query for height-only switches without stuck state or leaked listeners', () => {
      const changes = new Set<() => void>();
      let size = { w: 800, h: 400 };
      const mq = {
        get matches() { return size.w <= 479 || size.h <= 499; },
        addEventListener: (_: string, l: () => void) => changes.add(l),
        removeEventListener: (_: string, l: () => void) => changes.delete(l),
      };
      const resize = (w: number, h: number) => { size = { w, h }; for (const l of [...changes]) l(); };
      setup();
      const mm = vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
      const wrap = document.createElement('div') as unknown as MockElement;
      const d = createDock('main') as unknown as MockElement;
      wrap.appendChild(d);
      mountMoreToggle(wrap as unknown as HTMLElement, d as unknown as HTMLElement);
      const arrow = wrap.querySelector('.quick-dock__more')!;
      expect(mm).toHaveBeenCalledWith(COMPACT_QUERY);
      expect(mq.matches).toBe(true);
      expect(d.hasAttribute('inert')).toBe(true);
      arrow.click();
      expect(d.hasAttribute('data-open')).toBe(true);
      resize(800, 600);
      expect(mq.matches).toBe(false);
      expect(d.hasAttribute('data-open')).toBe(false);
      expect(d.hasAttribute('inert')).toBe(false);
      expect(arrow.getAttribute('aria-expanded')).toBe('false');
      expect(docListeners.get('pointerdown')?.size ?? 0).toBe(0);
      expect(docListeners.get('keydown')?.size ?? 0).toBe(0);
      resize(800, 400);
      expect(d.hasAttribute('data-open')).toBe(false);
      expect(d.hasAttribute('inert')).toBe(true);
      arrow.click();
      resize(800, 600);
      resize(800, 400);
      expect(d.hasAttribute('data-open')).toBe(false);
      expect(docListeners.get('keydown')?.size ?? 0).toBe(0);
    });

    it('renders an accessible arrow wired to the dock and hides collapsed icons', () => {
      const { dock, more } = setup();
      expect(more.getAttribute('aria-label')).toBe('More options');
      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(more.getAttribute('aria-controls')).toBe(dock.id);
      expect(more.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(dock.hasAttribute('inert')).toBe(true);
      expect(dock.getAttribute('aria-hidden')).toBe('true');
      for (const b of dock.querySelectorAll('.quick-dock__button')) expect(b.getAttribute('tabindex')).toBe('-1');
      expect(docListeners.size).toBe(0);
    });

    it('expands on tap and collapses on arrow, outside pointerdown, Esc and action select', async () => {
      const { dock, more } = setup();
      const open = () => { more.click(); expect(more.getAttribute('aria-expanded')).toBe('true'); expect(dock.hasAttribute('data-open')).toBe(true); expect(dock.hasAttribute('inert')).toBe(false); expect(dock.querySelector('button')?.hasAttribute('tabindex')).toBe(false); };
      const closed = () => { expect(more.getAttribute('aria-expanded')).toBe('false'); expect(dock.hasAttribute('data-open')).toBe(false); expect(dock.hasAttribute('inert')).toBe(true); expect(docListeners.get('pointerdown')?.size ?? 0).toBe(0); expect(docListeners.get('keydown')?.size ?? 0).toBe(0); };
      open(); more.click(); closed();
      open(); fire('pointerdown', { composedPath: () => [dock] }); expect(dock.hasAttribute('data-open')).toBe(true);
      fire('pointerdown', { composedPath: () => [more] }); expect(dock.hasAttribute('data-open')).toBe(true);
      fire('pointerdown', { composedPath: () => [document.body] }); closed();
      open(); fire('keydown', { key: 'Enter' }); expect(dock.hasAttribute('data-open')).toBe(true);
      fire('keydown', { key: 'Escape' }); closed();
      open(); dock.querySelectorAll('.quick-dock__button')[1]!.click(); closed();
      await vi.waitFor(() => expect(runAction).toHaveBeenCalledWith('email', { page: 'main' }));
    });

    it('leaves the dock interactive outside compact mode and styles hide tooltips on compact', () => {
      const { dock } = setup(false);
      expect(dock.hasAttribute('inert')).toBe(false);
      expect(dock.querySelector('button')?.hasAttribute('tabindex')).toBe(false);
      expect(dockStyles).toContain('.quick-dock__more { display: none; }');
      expect(dockStyles).toContain('.quick-dock__button::after { display: none; }');
      expect(dockStyles).toContain('.quick-dock__more[aria-expanded="true"] svg { transform: rotate(180deg); }');
    });
  });
});

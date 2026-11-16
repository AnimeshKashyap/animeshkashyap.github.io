import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDock, dockStyles } from './dock';
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

  it('places closed labels on the right without crossing the icon or safe edges', () => {
    expect(dockStyles).toContain('left: calc(100% + 8px); right: auto; top: 50%');
    expect(dockStyles).toContain('transform: translateY(-50%)');
    expect(dockStyles).toContain('box-sizing: border-box; width: max-content');
    expect(dockStyles).toContain('max-width: max(0px, calc(100vw - max(16px, env(safe-area-inset-left, 0px)) - 64px - env(safe-area-inset-right, 0px)))');
    expect(dockStyles).toContain('overflow-wrap: anywhere');
    // Model the CSS border boxes: the closed icon is offset 16px from the launcher.
    for (const [viewport, safeLeft, safeRight, labelWidth] of [
      [320, 0, 0, 150], [320, 40, 24, 500], [768, 100, 32, 1000], [240, 16, 20, 80],
    ]) {
      const iconLeft = Math.max(16, safeLeft!) + 16;
      const iconRight = iconLeft + 40;
      const labelLeft = iconRight + 8;
      const labelRight = labelLeft + Math.min(labelWidth!, Math.max(0, viewport! - Math.max(16, safeLeft!) - 64 - safeRight!));
      expect(iconLeft - 8 - safeLeft!).toBeLessThanOrEqual(24); // too little room for normal labels
      expect(labelLeft).toBeGreaterThan(iconRight);
      expect(labelRight).toBeLessThanOrEqual(viewport! - safeRight!);
    }
    expect(dockStyles).toContain('left: 50%; right: auto; top: auto; bottom: calc(100% + 8px)');
    expect(dockStyles).toContain(':focus-visible::after');
  });

  it('right-aligns the closed buttons with the 56px launcher', () => {
    expect(dockStyles).toContain('left: calc(max(16px, env(safe-area-inset-left, 0px)) + 16px)');
    expect(dockStyles).toContain('width: 40px; height: 40px');
    expect(16 + 40).toBe(56);
  });

  it('moves the dock and buttons with transforms and honors reduced motion', () => {
    expect(dockStyles).toContain('.launcher[aria-expanded="true"] ~ .quick-dock');
    expect(dockStyles).toContain('transform: translate(var(--dock-x, 0px), var(--dock-y, 0px))');
    expect(dockStyles).toContain('transition: transform 240ms ease');
    expect(dockStyles).not.toMatch(/transition:\s*[^;]*(?:left|bottom)/);
    expect(dockStyles).toContain('translateY(calc(var(--index) * -46px))');
    expect(dockStyles).toContain('translateX(calc(var(--index) * 46px))');
    expect(dockStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(dockStyles).toContain('.quick-dock, .quick-dock__button { transition: none; }');
    expect(dockStyles).toContain('@media (min-width: 480px) and (max-height: 750px)');
    expect(dockStyles).toContain('top: calc(100% + 8px); bottom: auto');
    expect(dockStyles).toContain('@media (max-width: 223px)');
    expect(dockStyles).toContain('.quick-dock__button:last-child::after { left: auto; right: 0;');
  });
});

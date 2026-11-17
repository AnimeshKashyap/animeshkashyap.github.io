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
});

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
      expect(button.getAttribute('aria-label')).toBe(label);
      expect(button.getAttribute('data-tooltip')).toBe(label);
      expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(button.querySelector('path')?.getAttribute('d')).toBeTruthy();
      button.click();
      await vi.waitFor(() => expect(runAction).toHaveBeenCalledWith(id, { page }));
    }
    expect(runAction).toHaveBeenCalledTimes(5);
  });

  it('supports right and above tooltips for the two orientations', () => {
    expect(dockStyles).toContain('left: calc(100% + 8px)');
    expect(dockStyles).toContain('.launcher[aria-expanded="true"] ~ .quick-dock');
    expect(dockStyles).toContain('bottom: calc(100% + 8px)');
    expect(dockStyles).toContain(':focus-visible::after');
    expect(dockStyles).toContain('transition: left 240ms ease, bottom 240ms ease');
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

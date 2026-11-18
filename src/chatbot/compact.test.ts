/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_QUERY, matchCompactMode, resolveCompactStyles } from './compact';
import { dockStyles } from './dock';
import { buildLauncherStyles } from './launcher';

const panelCss = readFileSync(fileURLToPath(new URL('./panel/panel.css', import.meta.url)), 'utf8');

afterEach(() => vi.unstubAllGlobals());

describe('shared compact media contract', () => {
  it('uses the exact inclusive width OR height query and returns its live MediaQueryList', () => {
    expect(COMPACT_QUERY).toBe('(max-width: 479px), (max-height: 499px)');
    const result = { matches: false, addEventListener: vi.fn() };
    const matchMedia = vi.fn().mockReturnValue(result);
    vi.stubGlobal('window', { matchMedia });
    expect(matchCompactMode()).toBe(result);
    expect(matchMedia).toHaveBeenCalledExactlyOnceWith(COMPACT_QUERY);
  });

  it.each([
    [479, 900, true], [480, 900, false],
    [900, 499, true], [900, 500, false],
    [479, 499, true], [480, 500, false],
    [844, 390, true], [1280, 800, false],
  ])('classifies the query contract at %i × %i as compact=%s', (width, height, expected) => {
    // Static contract evaluation, not browser/layout verification.
    const matches = COMPACT_QUERY.split(',').some((clause) => {
      const [, axis, maximum] = clause.match(/max-(width|height): (\d+)px/)!;
      return (axis === 'width' ? width : height) <= Number(maximum);
    });
    expect(matches).toBe(expected);
  });

  it.each(['main', 'v4'] as const)('resolves launcher, dock and panel CSS consistently on %s', (page) => {
    const launcher = buildLauncherStyles(page);
    const panel = resolveCompactStyles(panelCss);
    expect(launcher).toContain(`@media ${COMPACT_QUERY}`);
    expect(panel).toContain(`@media ${COMPACT_QUERY}`);
    for (const styles of [launcher, dockStyles, panel]) {
      expect(styles).toMatch(/@media\s*\(min-width:\s*480px\)\s*and\s*\(min-height:\s*500px\)/);
      expect(styles).not.toContain('--chatbot-compact');
      expect(styles).not.toContain('--chatbot-desktop');
    }
    expect(resolveCompactStyles(panel)).toBe(panel);
  });
});

import { describe, expect, it } from 'vitest';
import { buildLauncherStyles } from './launcher';

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
});
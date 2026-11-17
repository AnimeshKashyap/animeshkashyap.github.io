/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reply } from '../types';
import { mountLauncher } from '../launcher';
import { CHATBOT_CONFIG } from '../config';
import {
  installBrowserGlobals,
  registerElementById,
  type BrowserGlobalsHandle,
  type MockElement,
  type MockShadowRoot,
} from './fixtures/browser-globals';
import { makeReply } from './fixtures/replies';
const panelDir = dirname(fileURLToPath(import.meta.url));
const panelCss = readFileSync(join(panelDir, 'panel.css'), 'utf8');
const panelSource = readFileSync(join(panelDir, 'panel.ts'), 'utf8');
const chatbotReadme = readFileSync(join(panelDir, '../README.md'), 'utf8');

const HISTORY_KEY = 'portfolio-chatbot-history:main';
const LAUNCHER_BUBBLE_SESSION_KEY = 'portfolio-chatbot-launcher-bubble-seen';

const engineBehavior = {
  ask: vi.fn<(query: string) => Promise<Reply>>(),
};

vi.mock('../engine', () => ({
  createEngine: () => ({
    ask: (query: string) => engineBehavior.ask(query),
  }),
}));

function collectDescendants(root: MockElement): MockElement[] {
  const nodes: MockElement[] = [root];
  for (const child of root.childNodes) {
    nodes.push(...collectDescendants(child));
  }
  return nodes;
}

async function loadPanelApi(): Promise<{
  openPanel: () => void;
  isPanelOpen: () => boolean;
}> {
  return import('./panel');
}

function mountHost(): { host: MockElement; launcher: MockElement; shadow: MockShadowRoot } {
  const host = document.createElement('div') as unknown as MockElement;
  host.id = 'portfolio-chatbot-host';
  host.setAttribute('data-chatbot-page', 'main');
  registerElementById(host);
  (document.body as unknown as MockElement).appendChild(host);
  const launcher = mountLauncher(host as unknown as HTMLElement, 'main') as unknown as MockElement;
  const shadow = host.shadowRoot!;
  return { host, launcher, shadow };
}

function getPanel(shadow: MockShadowRoot): MockElement {
  const panel = shadow.querySelector('#portfolio-chat-panel');
  if (panel === null) {
    throw new Error('panel not mounted');
  }
  return panel;
}

function getResetHeaderButton(panel: MockElement): MockElement {
  const resetBtn = panel.querySelector('.chat-panel__actions button');
  if (resetBtn === null) {
    throw new Error('reset header button not found');
  }
  return resetBtn;
}

describe('chat panel', () => {
  let browser: BrowserGlobalsHandle;
  let openPanel: () => void;
  let isPanelOpen: () => boolean;

  beforeEach(async () => {
    browser = installBrowserGlobals();
    vi.resetModules();
    engineBehavior.ask.mockReset();
    engineBehavior.ask.mockResolvedValue(makeReply({ text: 'Assistant response' }));
    ({ openPanel, isPanelOpen } = await loadPanelApi());
  });

  afterEach(() => {
    browser.reset();
    vi.useRealTimers();
  });

  it('opens the panel and syncs launcher aria-expanded', () => {
    const { launcher, shadow } = mountHost();
    launcher.focus();

    openPanel();

    const panel = getPanel(shadow);
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
    expect(launcher.getAttribute('aria-label')).toBe('Close chat');
    expect(shadow.querySelector('.chat-panel__send')?.disabled).toBe(true);
  });

  it('shows welcome with five suggestions when storage is empty', () => {
    const { shadow } = mountHost();
    openPanel();

    const suggestions = collectDescendants(getPanel(shadow)).filter((node) =>
      node.classList.contains('chat-chip--suggestion'),
    );
    expect(suggestions).toHaveLength(5);
    expect(suggestions.map((node) => node.textContent)).toEqual(CHATBOT_CONFIG.suggestedQuestions);
  });

  it('disables send for whitespace-only input', async () => {
    const { shadow } = mountHost();
    openPanel();

    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    const send = shadow.querySelector('.chat-panel__send') as MockElement;
    input.value = '   \t  ';
    input.dispatchEvent('input');

    expect(send.disabled).toBe(true);

    const form = shadow.querySelector('.chat-panel__form') as MockElement;
    form.dispatchEvent('submit');
    await Promise.resolve();

    expect(engineBehavior.ask).not.toHaveBeenCalled();
    expect(getPanel(shadow).querySelectorAll('.chat-msg--user')).toHaveLength(0);
  });

  it('enables send only when trimmed text is present', () => {
    const { shadow } = mountHost();
    openPanel();

    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    const send = shadow.querySelector('.chat-panel__send') as MockElement;

    input.value = 'hello';
    input.dispatchEvent('input');
    expect(send.disabled).toBe(false);
  });

  it('sends a message, shows typing, and persists history', async () => {
    const { shadow } = mountHost();
    openPanel();

    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    const form = shadow.querySelector('.chat-panel__form') as MockElement;
    input.value = 'Tell me about skills';
    input.dispatchEvent('input');
    form.dispatchEvent('submit');

    const typing = shadow.querySelector('.chat-panel__typing') as MockElement;
    await Promise.resolve();
    expect(typing.hidden).toBe(false);

    await vi.waitFor(() => {
      expect(engineBehavior.ask).toHaveBeenCalledWith('Tell me about skills');
    });

    expect(browser.sessionData.get(HISTORY_KEY)).toContain('Tell me about skills');
    expect(getPanel(shadow).querySelectorAll('.chat-msg--bot').length).toBeGreaterThan(0);
    await vi.waitFor(() => expect(typing.hidden).toBe(true));
    expect(input.disabled).toBe(false);
    expect(shadow.querySelector('.chat-panel__send')?.disabled).toBe(true);
  });

  it('prevents duplicate submissions while a request is in flight', async () => {
    let resolveAsk!: (reply: Reply) => void;
    engineBehavior.ask.mockImplementation(
      () =>
        new Promise<Reply>((resolve) => {
          resolveAsk = resolve;
        }),
    );

    const { shadow } = mountHost();
    openPanel();

    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    const form = shadow.querySelector('.chat-panel__form') as MockElement;

    input.value = 'First';
    input.dispatchEvent('input');
    form.dispatchEvent('submit');

    await vi.waitFor(() => {
      expect(engineBehavior.ask).toHaveBeenCalledTimes(1);
    });

    form.dispatchEvent('submit');
    await Promise.resolve();
    expect(engineBehavior.ask).toHaveBeenCalledTimes(1);

    resolveAsk(makeReply());
    await vi.waitFor(() => {
      expect(input.disabled).toBe(false);
    });
  });



  it.each(['legacy', 'bubbles'] as const)('restores %s session history without replaying reveal', async (format) => {
    const reply: Partial<Reply> = makeReply({ text: 'Stored answer', sources: [], actions: [], suggestions: [] });
    if (format === 'legacy') {
      delete reply.bubbles;
    } else {
      reply.bubbles = ['Stored answer', 'Second bubble'];
      reply.text = 'Stale compatibility text';
    }
    const stored = [
      { kind: 'user', text: 'Stored question' },
      {
        kind: 'bot',
        reply,
      },
    ];
    browser.sessionData.set(HISTORY_KEY, JSON.stringify(stored));

    const { shadow } = mountHost();
    openPanel();

    await vi.waitFor(() => {
      expect(getPanel(shadow).textContent).toContain('Stored question');
      expect(getPanel(shadow).textContent).toContain('Stored answer');
    });
    if (format === 'bubbles') {
      expect(getPanel(shadow).textContent).toContain('Second bubble');
      expect(getPanel(shadow).textContent).not.toContain('Stale compatibility text');
    }

    const welcomeSuggestions = collectDescendants(getPanel(shadow)).filter(
      (node) =>
        node.classList.contains('chat-chip--suggestion') &&
        CHATBOT_CONFIG.suggestedQuestions.includes(node.textContent),
    );
    expect(welcomeSuggestions).toHaveLength(0);
    expect(getPanel(shadow).querySelector('.chat-msg__bubble--reveal')).toBeNull();
  });

  it('returns empty history when sessionStorage read throws', async () => {
    browser.sessionData.set(HISTORY_KEY, JSON.stringify([{ kind: 'user', text: 'hidden' }]));
    const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
    sessionStorage.getItem = () => {
      throw new Error('storage blocked');
    };

    const { shadow } = mountHost();
    openPanel();

    await vi.waitFor(() => {
      expect(collectDescendants(getPanel(shadow)).filter((n) => n.classList.contains('chat-chip--suggestion')))
        .toHaveLength(5);
    });
    expect(getPanel(shadow).textContent).not.toContain('hidden');

    sessionStorage.getItem = originalGetItem;
  });

  it('tolerates corrupted history JSON by clearing storage and showing welcome', async () => {
    browser.sessionData.set(HISTORY_KEY, '{unterminated');

    const { shadow } = mountHost();
    openPanel();

    await vi.waitFor(() => {
      expect(browser.sessionData.has(HISTORY_KEY)).toBe(false);
      expect(collectDescendants(getPanel(shadow)).filter((n) => n.classList.contains('chat-chip--suggestion')))
        .toHaveLength(5);
    });
  });

  it.each([
    { text: 42, sources: [], actions: [], suggestions: [] },
    { ...makeReply(), bubbles: 'not an array' },
    { ...makeReply(), bubbles: ['valid', 42] },
    { ...makeReply(), bubbles: null },
  ])('rejects malformed bot reply shapes in stored history: %j', async (reply) => {
    browser.sessionData.set(
      HISTORY_KEY,
      JSON.stringify([{ kind: 'bot', reply }]),
    );

    const { shadow } = mountHost();
    openPanel();

    await vi.waitFor(() => {
      expect(browser.sessionData.has(HISTORY_KEY)).toBe(false);
    });
    expect(collectDescendants(getPanel(shadow)).filter((n) => n.classList.contains('chat-chip--suggestion')))
      .toHaveLength(5);
  });

  it('reset after in-session messages clears storage and restores welcome', async () => {
    const { shadow } = mountHost();
    openPanel();

    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    const form = shadow.querySelector('.chat-panel__form') as MockElement;
    input.value = 'Live thread';
    input.dispatchEvent('input');
    form.dispatchEvent('submit');

    await vi.waitFor(() => {
      expect(engineBehavior.ask).toHaveBeenCalledWith('Live thread');
    });
    await vi.waitFor(() =>
      expect(getPanel(shadow).textContent).toContain('Assistant response'),
    );
    await vi.waitFor(() =>
      expect((shadow.querySelector('.chat-panel__typing') as MockElement).hidden).toBe(true),
    );
    expect(browser.sessionData.get(HISTORY_KEY)).toContain('Live thread');

    getResetHeaderButton(getPanel(shadow)).click();

    expect(browser.sessionData.has(HISTORY_KEY)).toBe(false);
    expect(getPanel(shadow).textContent).not.toContain('Live thread');
    expect(getPanel(shadow).textContent).not.toContain('Assistant response');
    expect(getPanel(shadow).querySelectorAll('.chat-msg--user')).toHaveLength(0);
    expect(
      collectDescendants(getPanel(shadow)).filter((n) => n.classList.contains('chat-chip--suggestion')),
    ).toHaveLength(5);
  });

  it('clears conversation, storage, and restores welcome', async () => {
    browser.sessionData.set(
      HISTORY_KEY,
      JSON.stringify([{ kind: 'user', text: 'Old message' }]),
    );

    const { shadow } = mountHost();
    openPanel();
    await vi.waitFor(() => expect(getPanel(shadow).textContent).toContain('Old message'));

    const clearBtn = [...collectDescendants(getPanel(shadow))].find(
      (node) => node.getAttribute('aria-label') === 'Reset chat',
    );
    clearBtn?.click();

    expect(browser.sessionData.has(HISTORY_KEY)).toBe(false);
    expect(getPanel(shadow).textContent).not.toContain('Old message');
    expect(collectDescendants(getPanel(shadow)).filter((n) => n.classList.contains('chat-chip--suggestion')))
      .toHaveLength(5);
  });

  it('ignores clear while a send is in progress', async () => {
    let resolveAsk!: (reply: Reply) => void;
    engineBehavior.ask.mockImplementation(
      () =>
        new Promise<Reply>((resolve) => {
          resolveAsk = resolve;
        }),
    );

    const { shadow } = mountHost();
    openPanel();

    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    const form = shadow.querySelector('.chat-panel__form') as MockElement;
    input.value = 'busy';
    input.dispatchEvent('input');
    form.dispatchEvent('submit');

    await vi.waitFor(() => {
      expect(engineBehavior.ask).toHaveBeenCalledTimes(1);
    });

    const clearBtn = [...collectDescendants(getPanel(shadow))].find(
      (node) => node.getAttribute('aria-label') === 'Reset chat',
    );
    clearBtn?.click();

    expect(getPanel(shadow).textContent).toContain('busy');

    resolveAsk(makeReply());
    await vi.waitFor(() => expect(input.disabled).toBe(false));
  });

  it('closes on Escape and returns focus to the launcher', () => {
    const { launcher, shadow } = mountHost();
    openPanel();

    const panel = getPanel(shadow);
    panel.dispatchEvent('keydown', { key: 'Escape' });

    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(launcher.getAttribute('aria-label')).toBe('Open chat');
    expect(browser.getFocusedElement()).toBe(launcher);
  });

  it('launcher open, close, and reopen keeps history and syncs focus and aria each step', async () => {
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');
    const { launcher, shadow } = mountHost();

    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(launcher.getAttribute('aria-label')).toBe('Open chat');

    launcher.click();
    await vi.waitFor(() => expect(isPanelOpen()).toBe(true));

    const panel = getPanel(shadow);
    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
    expect(launcher.getAttribute('aria-label')).toBe('Close chat');
    expect(browser.getFocusedElement()).toBe(input);

    input.value = 'Hello';
    const form = shadow.querySelector('.chat-panel__form') as MockElement;
    engineBehavior.ask.mockResolvedValueOnce(makeReply({ text: 'Hi there' }));
    form.dispatchEvent('submit');
    await vi.waitFor(() => expect(engineBehavior.ask).toHaveBeenCalled());
    expect(browser.sessionData.get(HISTORY_KEY)).toBeTruthy();

    launcher.click();
    await vi.waitFor(() => expect(isPanelOpen()).toBe(false));

    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(launcher.getAttribute('aria-label')).toBe('Open chat');
    expect(browser.getFocusedElement()).toBe(launcher);
    expect(browser.sessionData.get(HISTORY_KEY)).toBeTruthy();

    launcher.click();
    await vi.waitFor(() => expect(isPanelOpen()).toBe(true));

    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
    expect(launcher.getAttribute('aria-label')).toBe('Close chat');
    expect(browser.getFocusedElement()).toBe(input);
    expect(panel.textContent).toContain('Hello');
    expect(panel.textContent).toContain('Hi there');
  });

  it('closes via header control', () => {
    const { launcher, shadow } = mountHost();
    openPanel();

    const panel = getPanel(shadow);
    const closeBtn = [...collectDescendants(panel)].find(
      (node) => node.getAttribute('aria-label') === 'Close chat',
    );
    closeBtn?.click();

    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(launcher.getAttribute('aria-label')).toBe('Open chat');
    expect(browser.getFocusedElement()).toBe(launcher);
  });

  it('builds Reset icon via DOM nodes with rotate-ccw paths, currentColor, and aria-hidden', () => {
    const { shadow } = mountHost();
    openPanel();

    const resetBtn = getResetHeaderButton(getPanel(shadow));
    expect(resetBtn.innerHTML).toBe('');
    expect(resetBtn.childNodes).toHaveLength(1);
    expect(resetBtn.childNodes[0]?.tagName).toBe('SVG');

    const svg = resetBtn.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    expect(svg!.getAttribute('focusable')).toBe('false');
    expect(svg!.getAttribute('fill')).toBe('none');
    expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24');

    const paths = svg!.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.getAttribute('d'))).toEqual([
      'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
      'M3 3v5h5',
    ]);
    for (const path of paths) {
      expect(path.getAttribute('stroke')).toBe('currentColor');
      expect(path.getAttribute('stroke-width')).toBe('2');
    }
  });

  it('header has exactly Reset and Close with accessible names and CSS tooltips', () => {
    const { shadow } = mountHost();
    openPanel();

    const panel = getPanel(shadow);
    const actions = panel.querySelector('.chat-panel__actions');
    const headerButtons = [...(actions?.querySelectorAll('button') ?? [])];
    expect(headerButtons).toHaveLength(2);
    expect(headerButtons.map((btn) => btn.getAttribute('aria-label'))).toEqual([
      'Reset chat',
      'Close chat',
    ]);

    const resetBtn = headerButtons[0];
    const closeBtn = headerButtons[1];

    expect(resetBtn.getAttribute('data-tooltip')).toBe('Reset chat');
    expect(closeBtn.getAttribute('data-tooltip')).toBe('Close chat');
    expect(resetBtn.hasAttribute('title')).toBe(false);
    expect(closeBtn.hasAttribute('title')).toBe(false);
    expect(resetBtn.querySelector('svg')).not.toBeNull();
    expect(closeBtn.textContent).toBe('×');
  });

  it('panel CSS keeps header tooltips unclipped with edge-aware Close placement', () => {
    const panelRule = panelCss.match(/\.chat-panel\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(panelRule).not.toMatch(/\boverflow:\s*hidden\b/);

    expect(panelCss).toMatch(/\.chat-panel__body\s*\{[^}]*overflow:\s*hidden/s);
    expect(panelCss).toMatch(/\.chat-panel__header\s*\{[^}]*overflow:\s*visible/s);

    expect(panelCss).toMatch(/\.chat-panel__icon-btn\[data-tooltip\]:hover::after/s);
    expect(panelCss).toMatch(
      /\.chat-panel__icon-btn\[data-tooltip\]:focus-visible::after/s,
    );
    expect(panelCss).toMatch(/opacity\s+120ms\s+ease\s+400ms/);
    expect(panelCss).toMatch(/visibility\s+0s\s+linear\s+400ms/);

    expect(panelCss).toMatch(
      /\.chat-panel__actions\s*>\s*\.chat-panel__icon-btn:last-child\[data-tooltip\]::after[^}]*right:\s*0/s,
    );
    expect(panelCss).toMatch(
      /\.chat-panel__actions\s*>\s*\.chat-panel__icon-btn:last-child\[data-tooltip\]:hover::after/s,
    );
    expect(panelCss).toMatch(/var\(--bg-raised/);
    expect(panelCss).toMatch(/var\(--text-primary/);
    expect(panelCss).toMatch(/var\(--border/);
    expect(panelCss).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\[data-tooltip\]/s);
  });

  it('omits minimize-only symbols from panel implementation, styles, and README', () => {
    const minimizePattern =
      /\bminimize\b|panel--minimized|chat-panel__minimize|aria-label=['"]Restore/i;

    expect(panelSource).not.toMatch(minimizePattern);
    expect(panelSource).not.toMatch(/clearBtn\.innerHTML/);
    expect(panelCss).not.toMatch(minimizePattern);
    expect(chatbotReadme).not.toMatch(/\bminimize\b/i);
    expect(panelCss).toMatch(/\.chat-panel__icon-btn svg\s*\{/);
  });

  it('does not render a quick-action toolbar in the panel', () => {
    const { shadow } = mountHost();
    openPanel();

    expect(shadow.querySelector('.chat-panel__quick-actions')).toBeNull();
    expect(shadow.querySelector('.chat-chip--quick')).toBeNull();
  });

  it('keeps the dock as a launcher sibling and switches its CSS state on open and close', async () => {
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');
    const { launcher, shadow } = mountHost();
    const wrap = shadow.querySelector('.launcher-wrap')!;
    const dock = wrap.querySelector('.quick-dock')!;
    expect(wrap.childNodes.indexOf(dock)).toBeGreaterThan(wrap.childNodes.indexOf(launcher));
    expect(dock.querySelectorAll('.quick-dock__button')).toHaveLength(5);
    expect(launcher.getAttribute('aria-expanded')).toBe('false');

    launcher.click();
    await vi.waitFor(() => expect(launcher.getAttribute('aria-expanded')).toBe('true'));
    expect(getPanel(shadow).querySelector('.quick-dock')).toBeNull();
    expect(wrap.querySelector('.quick-dock')).toBe(dock);

    launcher.click();
    await vi.waitFor(() => expect(launcher.getAttribute('aria-expanded')).toBe('false'));
    expect(wrap.querySelector('.quick-dock')).toBe(dock);
  });
});
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reply } from '../types';
import { mountLauncher } from '../launcher';
import { CHATBOT_CONFIG, CHATBOT_KEYWORDS } from '../config';
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

  async function autocomplete(prefix = 'what') {
    // Keep window's bound timer functions on the same clock as global timers.
    if (!vi.isFakeTimers()) vi.useFakeTimers();
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');
    const { shadow } = mountHost();
    openPanel();
    const input = shadow.querySelector('.chat-panel__input')!;
    const list = shadow.querySelector('.chat-panel__autocomplete')!;
    input.dispatchEvent('focus');
    input.value = prefix;
    input.dispatchEvent('input');
    expect(list.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(79);
    expect(list.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    return { shadow, input, list };
  }

  it('locks compact pages, tracks the keyboard viewport and restores overflow/focus on close', () => {
    const values = new Map([['overflow', 'scroll']]);
    const style = {
      getPropertyValue: (name: string) => values.get(name) ?? '',
      getPropertyPriority: () => 'important',
      setProperty: vi.fn((name: string, value: string) => values.set(name, value)),
      removeProperty: (name: string) => values.delete(name),
    };
    Object.assign(document, { documentElement: { style } });
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const listeners = new Map<string, () => void>();
    const viewport = {
      height: 420, offsetTop: 12,
      addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
      removeEventListener: (name: string) => listeners.delete(name),
    };
    Object.assign(window, { visualViewport: viewport });
    let onRemoval: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('MutationObserver', class {
      constructor(callback: () => void) { onRemoval = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const { shadow, launcher } = mountHost();
    // The fixture has a deliberately minimal CSSStyleDeclaration.
    openPanel();
    const panel = getPanel(shadow);
    expect(values.get('overflow')).toBe('hidden');
    expect(panel.style._values['--chat-viewport-height']).toBe('420px');
    viewport.height = 300;
    listeners.get('resize')!();
    expect(panel.style._values['--chat-viewport-height']).toBe('300px');
    getResetHeaderButton(panel).click();
    expect(values.get('overflow')).toBe('hidden');
    panel.dispatchEvent('keydown', { key: 'Escape' });
    expect(style.setProperty).toHaveBeenLastCalledWith('overflow', 'scroll', 'important');
    expect(browser.getFocusedElement()).toBe(launcher);
    expect(listeners.size).toBe(0);
    openPanel();
    onRemoval();
    expect(values.get('overflow')).toBe('scroll');
    expect(isPanelOpen()).toBe(false);
    expect(disconnect).toHaveBeenCalled();
  });

  it('leaves desktop overflow untouched and closes through the header with launcher focus', () => {
    const setProperty = vi.fn();
    Object.assign(document, { documentElement: { style: { setProperty } } });
    const { shadow, launcher } = mountHost();
    openPanel();
    const actions = getPanel(shadow).querySelector('.chat-panel__actions')!;
    actions.children[1].click();
    expect(isPanelOpen()).toBe(false);
    expect(browser.getFocusedElement()).toBe(launcher);
    expect(setProperty).not.toHaveBeenCalled();
  });

  it('defines a safe-area full-screen compact shell without disabling log scrolling', () => {
    expect(panelCss).toContain('height: var(--chat-viewport-height, 100dvh)');
    expect(panelCss).toContain('width: 100vw');
    for (const side of ['top', 'bottom', 'left', 'right']) {
      expect(panelCss).toContain(`env(safe-area-inset-${side}, 0px)`);
    }
    expect(panelCss).toContain('overflow-y: auto');
    expect(panelCss).toContain('overscroll-behavior: contain');
    expect(panelCss).toContain('-webkit-overflow-scrolling: touch');
  });

  it('debounces up to three accessible options directly above the form, separate from chips', async () => {
    const { shadow, input, list } = await autocomplete();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(list.getAttribute('role')).toBe('listbox');
    expect(list.children).toHaveLength(3);
    expect(list.children.every((option) => option.getAttribute('role') === 'option')).toBe(true);
    const body = shadow.querySelector('.chat-panel__body')!;
    expect(body.children.indexOf(list) + 1).toBe(body.children.indexOf(shadow.querySelector('.chat-panel__form')!));
    expect(list.querySelector('.chat-chip')).toBeNull();
  });

  it.each(['Tab', 'ArrowRight'])('fills a highlighted sentence without sending on %s', async (key) => {
    const { input, list } = await autocomplete();
    const nativeInput = input as unknown as HTMLInputElement;
    nativeInput.selectionStart = input.value.length;
    nativeInput.selectionEnd = input.value.length;
    input.dispatchEvent('keydown', { key: 'ArrowDown' });
    const sentence = list.children[0].textContent;
    expect(input.getAttribute('aria-activedescendant')).toBe(list.children[0].id);
    expect(list.children[0].getAttribute('aria-selected')).toBe('true');
    input.dispatchEvent('keydown', { key });
    expect(input.value).toBe(sentence);
    expect(list.hidden).toBe(true);
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect(engineBehavior.ask).not.toHaveBeenCalled();
  });

  it.each(['Enter', 'click'])('sends highlighted autocomplete via %s and hides immediately', async (method) => {
    const { input, list } = await autocomplete();
    input.dispatchEvent('keydown', { key: 'ArrowUp' });
    const option = list.children[2];
    option.dispatchEvent('mouseenter');
    const sentence = option.textContent;
    if (method === 'click') option.click();
    else input.dispatchEvent('keydown', { key: 'Enter' });
    expect(list.hidden).toBe(true);
    expect(input.value).toBe('');
    await vi.advanceTimersByTimeAsync(0);
    expect(engineBehavior.ask).toHaveBeenCalledWith(sentence);
  });

  it('keeps typed submit behavior without a highlight', async () => {
    const { shadow, list } = await autocomplete();
    shadow.querySelector('.chat-panel__form')!.dispatchEvent('submit');
    expect(list.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(engineBehavior.ask).toHaveBeenCalledWith('what');
  });

  it('hides on blur, cancels pending matches, and suppresses no matches', async () => {
    const { input, list } = await autocomplete();
    input.dispatchEvent('blur');
    expect(list.hidden).toBe(true);
    input.dispatchEvent('input');
    await vi.advanceTimersByTimeAsync(80);
    expect(list.hidden).toBe(true);
    input.dispatchEvent('focus');
    input.dispatchEvent('blur');
    await vi.advanceTimersByTimeAsync(80);
    expect(list.hidden).toBe(true);
    input.value = 'zzzzzzzz';
    input.dispatchEvent('focus');
    await vi.advanceTimersByTimeAsync(80);
    expect(list.hidden).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('dismisses the list before closing the panel on Escape', async () => {
    const { shadow, list } = await autocomplete();
    const panel = getPanel(shadow);
    panel.dispatchEvent('keydown', { key: 'Escape' });
    expect(list.hidden).toBe(true);
    expect(isPanelOpen()).toBe(true);
    panel.dispatchEvent('keydown', { key: 'Escape' });
    expect(isPanelOpen()).toBe(false);
  });

  it('does not fill on Right in the middle of text or show matches while busy', async () => {
    const { shadow, input, list } = await autocomplete();
    const nativeInput = input as unknown as HTMLInputElement;
    nativeInput.selectionStart = 1;
    nativeInput.selectionEnd = 1;
    input.dispatchEvent('keydown', { key: 'ArrowDown' });
    input.dispatchEvent('keydown', { key: 'ArrowRight' });
    expect(input.value).toBe('what');
    expect(list.hidden).toBe(false);
    engineBehavior.ask.mockImplementation(() => new Promise<Reply>(() => {}));
    shadow.querySelector('.chat-panel__form')!.dispatchEvent('submit');
    input.value = 'what';
    input.dispatchEvent('input');
    await vi.advanceTimersByTimeAsync(80);
    expect(list.hidden).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    getResetHeaderButton(getPanel(shadow)).click();
  });

  it('wraps keyboard selection and transfers ARIA selection on hover', async () => {
    const { input, list } = await autocomplete();
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    for (const [key, index] of [
      ['ArrowUp', 2], ['ArrowDown', 0], ['ArrowDown', 1], ['ArrowUp', 0], ['ArrowUp', 2],
    ] as const) {
      input.dispatchEvent('keydown', { key });
      expect(input.getAttribute('aria-activedescendant')).toBe(list.children[index].id);
      expect(list.children.map((option) => option.getAttribute('aria-selected')))
        .toEqual(list.children.map((_, position) => String(position === index)));
    }
    list.children[1].dispatchEvent('mouseenter');
    expect(input.getAttribute('aria-activedescendant')).toBe(list.children[1].id);
    expect(list.children[2].getAttribute('aria-selected')).toBe('false');
    expect(engineBehavior.ask).not.toHaveBeenCalled();
  });

  it('restarts debounce for new text and clears stale selection for short or empty input', async () => {
    const { input, list } = await autocomplete();
    input.dispatchEvent('keydown', { key: 'ArrowDown' });
    input.value = 'college';
    input.dispatchEvent('input');
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    await vi.advanceTimersByTimeAsync(79);
    input.value = 'resume';
    input.dispatchEvent('input');
    await vi.advanceTimersByTimeAsync(79);
    expect(list.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(list.children.map((option) => option.textContent)).toEqual(['How can I download his resume?']);
    for (const value of ['a', '', '   ']) {
      input.value = value;
      input.dispatchEvent('input');
      await vi.advanceTimersByTimeAsync(80);
      expect(list.hidden).toBe(true);
      expect(list.children).toHaveLength(0);
      expect(input.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('does not complete on Shift-Tab, composing keys, or Right with a text selection', async () => {
    const { input, list } = await autocomplete();
    input.dispatchEvent('keydown', { key: 'ArrowDown', isComposing: true });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    input.dispatchEvent('keydown', { key: 'ArrowDown' });
    input.dispatchEvent('keydown', { key: 'Tab', shiftKey: true });
    const nativeInput = input as unknown as HTMLInputElement;
    nativeInput.selectionStart = 0;
    nativeInput.selectionEnd = input.value.length;
    input.dispatchEvent('keydown', { key: 'ArrowRight' });
    input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
    expect(input.value).toBe('what');
    expect(list.hidden).toBe(false);
    expect(engineBehavior.ask).not.toHaveBeenCalled();
  });

  it('keeps autocomplete hidden throughout resolved reply playback, then restores on focus', async () => {
    vi.useFakeTimers();
    browser.reset();
    browser = installBrowserGlobals();
    browser.setReducedMotion(false);
    engineBehavior.ask.mockResolvedValue(makeReply({ bubbles: ['First', 'Second'] }));
    const { shadow, input, list } = await autocomplete();
    shadow.querySelector('.chat-panel__form')!.dispatchEvent('submit');
    await vi.advanceTimersByTimeAsync(0);
    for (let stage = 0; stage < 4; stage++) {
      expect(input.disabled).toBe(true);
      input.value = 'what';
      input.dispatchEvent('focus');
      input.dispatchEvent('input');
      await vi.advanceTimersByTimeAsync(80);
      expect(list.hidden).toBe(true);
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(input.getAttribute('aria-activedescendant')).toBeNull();
      await vi.advanceTimersByTimeAsync(20);
    }
    await vi.runAllTimersAsync();
    expect(input.disabled).toBe(false);
    input.dispatchEvent('focus');
    await vi.advanceTimersByTimeAsync(80);
    expect(list.hidden).toBe(false);
  });

  it('uses bounded, wrapping theme-token styles and no HTML injection for autocomplete', () => {
    expect(panelCss).toMatch(/\.chat-panel__autocomplete\s*\{[^}]*max-height:\s*min\(180px, 30dvh\)/s);
    expect(panelCss).toMatch(/\.chat-panel__option\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    expect(panelCss).toMatch(/\.chat-panel__option\s*\{[^}]*var\(--text-primary/s);
    expect(panelSource).not.toMatch(/\.innerHTML\s*=/);
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

  it('shows welcome with all keyword suggestions when storage is empty', () => {
    const { shadow } = mountHost();
    openPanel();

    const suggestions = collectDescendants(getPanel(shadow)).filter((node) =>
      node.classList.contains('chat-chip--suggestion'),
    );
    expect(suggestions).toHaveLength(8);
    expect(suggestions.map((node) => node.textContent)).toEqual(CHATBOT_KEYWORDS.map(({ label }) => label));
  });

  it.each(CHATBOT_KEYWORDS)('sends the canonical question for $label and displays it in the user bubble', async ({ label, query }) => {
    const { shadow } = mountHost();
    openPanel();
    const chip = collectDescendants(getPanel(shadow)).find((node) =>
      node.classList.contains('chat-chip--suggestion') && node.textContent === label,
    );
    chip!.click();
    expect(getPanel(shadow).querySelector('.chat-msg--user')?.textContent).toBe(query);
    await vi.waitFor(() => expect(engineBehavior.ask).toHaveBeenCalledWith(query));
    await vi.waitFor(() => expect(shadow.querySelector('.chat-panel__typing')).toBeNull());
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
    await vi.waitFor(() => expect(shadow.querySelector('.chat-panel__typing')).toBeNull());
    await vi.waitFor(() => expect(input.disabled).toBe(false));
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
    vi.useFakeTimers();
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');
    const reply: Partial<Reply> = makeReply({ text: 'Stored answer' });
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

    const panel = getPanel(shadow);
    expect(panel.textContent).toContain('Stored question');
    expect(panel.querySelectorAll('.chat-msg--bot').map((row) =>
      row.querySelector('.chat-msg__bubble')?.textContent,
    )).toEqual(format === 'legacy' ? ['Stored answer'] : ['Stored answer', 'Second bubble']);
    expect(panel.textContent).not.toContain('Stale compatibility text');
    expect(panel.querySelectorAll('.chat-msg__source-chip').map((chip) => chip.textContent))
      .toEqual(['Profile']);
    expect(panel.querySelectorAll('.chat-chip--action').map((chip) => chip.textContent))
      .toEqual([CHATBOT_CONFIG.actions.linkedin.label]);
    expect(panel.querySelectorAll('.chat-chip--suggestion').map((chip) => chip.textContent))
      .toEqual(['Follow up question?']);
    expect(panel.querySelector('.chat-panel__typing')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(engineBehavior.ask).not.toHaveBeenCalled();
    expect(browser.sessionData.get(HISTORY_KEY)).toBe(JSON.stringify(stored));

    const welcomeSuggestions = collectDescendants(getPanel(shadow)).filter(
      (node) =>
        node.classList.contains('chat-chip--suggestion') &&
        CHATBOT_CONFIG.suggestedQuestions.includes(node.textContent),
    );
    expect(welcomeSuggestions).toHaveLength(0);
    expect(getPanel(shadow).querySelector('.chat-msg__bubble--reveal')).toBeNull();
  });

  it('restores and sends legacy sentence suggestions unchanged', async () => {
    const sentence = 'Tell me about his work experience.';
    const reply: Partial<Reply> = makeReply({ suggestions: [sentence] });
    delete reply.bubbles;
    browser.sessionData.set(HISTORY_KEY, JSON.stringify([{ kind: 'bot', reply }]));
    const { shadow } = mountHost();
    openPanel();

    const panel = getPanel(shadow);
    const chips = panel.querySelectorAll('.chat-chip--suggestion');
    expect(chips.map((chip) => chip.textContent)).toEqual([sentence]);
    expect(engineBehavior.ask).not.toHaveBeenCalled();
    chips[0].click();
    expect(panel.querySelector('.chat-msg--user')?.textContent).toBe(sentence);
    await vi.waitFor(() => expect(engineBehavior.ask).toHaveBeenCalledWith(sentence));
    await vi.waitFor(() => expect(shadow.querySelector('.chat-panel__typing')).toBeNull());
    expect(browser.sessionData.get(HISTORY_KEY)).toContain(sentence);
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
        .toHaveLength(8);
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
        .toHaveLength(8);
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
      .toHaveLength(8);
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
      expect(shadow.querySelector('.chat-panel__typing')).toBeNull(),
    );
    expect(browser.sessionData.get(HISTORY_KEY)).toContain('Live thread');

    getResetHeaderButton(getPanel(shadow)).click();

    expect(browser.sessionData.has(HISTORY_KEY)).toBe(false);
    expect(getPanel(shadow).textContent).not.toContain('Live thread');
    expect(getPanel(shadow).textContent).not.toContain('Assistant response');
    expect(getPanel(shadow).querySelectorAll('.chat-msg--user')).toHaveLength(0);
    expect(
      collectDescendants(getPanel(shadow)).filter((n) => n.classList.contains('chat-chip--suggestion')),
    ).toHaveLength(8);
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
      .toHaveLength(8);
  });

  it.each(['reset', 'close', 'Escape'])('cancels late engine replies on %s', async (control) => {
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
    if (control === 'reset') clearBtn?.click();
    else if (control === 'Escape') getPanel(shadow).dispatchEvent('keydown', { key: 'Escape' });
    else collectDescendants(getPanel(shadow)).find((node) => node.getAttribute('aria-label') === 'Close chat')?.click();
    expect(shadow.querySelector('.chat-panel__typing')).toBeNull();
    resolveAsk(makeReply({ text: 'Cancelled answer' }));
    await vi.waitFor(() => expect(input.disabled).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getPanel(shadow).textContent).not.toContain('Cancelled answer');
    expect(browser.sessionData.get(HISTORY_KEY) ?? '').not.toContain('Cancelled answer');
  });

  it.each(['reset', 'close', 'Escape'])('cancels staged timers on %s', async (control) => {
    vi.useFakeTimers();
    browser.reset();
    browser = installBrowserGlobals();
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');
    browser.setReducedMotion(false);
    const { shadow } = mountHost();
    openPanel();
    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    input.value = 'Stage this';
    (shadow.querySelector('.chat-panel__form') as MockElement).dispatchEvent('submit');
    await vi.advanceTimersByTimeAsync(0);
    expect(engineBehavior.ask).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(true);
    expect(getPanel(shadow).querySelector('.chat-msg--user')?.textContent).toBe('Stage this');
    expect(vi.getTimerCount()).toBe(1);
    if (control === 'reset') getResetHeaderButton(getPanel(shadow)).click();
    else if (control === 'Escape') getPanel(shadow).dispatchEvent('keydown', { key: 'Escape' });
    else collectDescendants(getPanel(shadow)).find((node) => node.getAttribute('aria-label') === 'Close chat')?.click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.getTimerCount()).toBe(0);
    expect(shadow.querySelector('.chat-panel__typing')).toBeNull();
    expect(input.disabled).toBe(false);
    expect(getPanel(shadow).textContent).not.toContain('Assistant response');
    expect(browser.sessionData.get(HISTORY_KEY) ?? '').not.toContain('Assistant response');
  });

  it.each([false, true])('keeps input busy until complete playback (reduced motion: %s)', async (reduced) => {
    vi.useFakeTimers();
    browser.reset();
    browser = installBrowserGlobals();
    browser.sessionData.set(LAUNCHER_BUBBLE_SESSION_KEY, '1');
    browser.setReducedMotion(reduced);
    engineBehavior.ask.mockResolvedValue(makeReply({ bubbles: ['First', 'Second'] }));
    const { shadow } = mountHost();
    openPanel();
    const input = shadow.querySelector('.chat-panel__input') as MockElement;
    const panel = getPanel(shadow);
    input.value = 'Question';
    (shadow.querySelector('.chat-panel__form') as MockElement).dispatchEvent('submit');
    expect(input.disabled).toBe(true);
    expect(panel.querySelector('.chat-msg--user')?.textContent).toBe('Question');
    await vi.advanceTimersByTimeAsync(0);
    if (!reduced) {
      expect(input.disabled).toBe(true);
      await vi.advanceTimersByTimeAsync(399);
      expect(input.disabled).toBe(true);
      expect(panel.textContent).not.toContain('Follow up question?');
      expect(browser.sessionData.get(HISTORY_KEY)).not.toContain('First');
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(input.disabled).toBe(false);
    expect(panel.textContent).toContain('Follow up question?');
    expect(browser.sessionData.get(HISTORY_KEY)).toContain('First');
    expect(panel.querySelector('.chat-panel__typing')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
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
    await vi.waitFor(() => expect(panel.textContent).toContain('Hi there'));
    await vi.waitFor(() => expect(input.disabled).toBe(false));

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
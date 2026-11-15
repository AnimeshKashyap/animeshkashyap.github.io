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



  it('restores valid session history without replaying reveal', async () => {
    const stored = [
      { kind: 'user', text: 'Stored question' },
      {
        kind: 'bot',
        reply: makeReply({ text: 'Stored answer', sources: [], actions: [], suggestions: [] }),
      },
    ];
    browser.sessionData.set(HISTORY_KEY, JSON.stringify(stored));

    const { shadow } = mountHost();
    openPanel();

    await vi.waitFor(() => {
      expect(getPanel(shadow).textContent).toContain('Stored question');
      expect(getPanel(shadow).textContent).toContain('Stored answer');
    });

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

  it('rejects malformed bot reply shapes in stored history', async () => {
    browser.sessionData.set(
      HISTORY_KEY,
      JSON.stringify([{ kind: 'bot', reply: { text: 42, sources: [], actions: [], suggestions: [] } }]),
    );

    const { shadow } = mountHost();
    openPanel();

    await vi.waitFor(() => {
      expect(browser.sessionData.has(HISTORY_KEY)).toBe(false);
    });
    expect(collectDescendants(getPanel(shadow)).filter((n) => n.classList.contains('chat-chip--suggestion')))
      .toHaveLength(5);
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
      (node) => node.getAttribute('aria-label') === 'Clear conversation',
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
      (node) => node.getAttribute('aria-label') === 'Clear conversation',
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

  it('renders five quick actions in the toolbar', () => {
    const { shadow } = mountHost();
    openPanel();

    const quick = shadow.querySelector('.chat-panel__quick-actions');
    expect(quick?.getAttribute('role')).toBe('toolbar');
    expect(quick?.querySelectorAll('.chat-chip--quick')).toHaveLength(5);
  });
});
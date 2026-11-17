import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHATBOT_CONFIG } from '../config';
import {
  appendBotMessage,
  appendUserMessage,
  appendWelcomeMessage,
  clearMessageLog,
  createMessageLog,
  setTypingVisible,
} from './messages';
import {
  asHtmlElement,
  installBrowserGlobals,
  type BrowserGlobalsHandle,
  type MockElement,
} from './fixtures/browser-globals';
import { hostileMarkupText, makeReply } from './fixtures/replies';

function collectDescendants(root: HTMLElement | MockElement): MockElement[] {
  const element = root as unknown as MockElement;
  const nodes: MockElement[] = [element];
  for (const child of element.childNodes) {
    nodes.push(...collectDescendants(child));
  }
  return nodes;
}

function textFromTree(root: HTMLElement | MockElement): string {
  return collectDescendants(root)
    .map((node) => node.textContent)
    .join('');
}

describe('chat panel messages', () => {
  let browser: BrowserGlobalsHandle;

  beforeEach(() => {
    vi.useFakeTimers();
    browser = installBrowserGlobals();
  });

  afterEach(() => {
    browser.reset();
    vi.useRealTimers();
  });

  it('creates an aria-live message log', () => {
    const log = createMessageLog();
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(log.getAttribute('aria-relevant')).toBe('additions');
    expect(log.getAttribute('tabindex')).toBe('0');
  });

  it('renders welcome greeting and five suggestion chips', () => {
    const log = createMessageLog();
    const onSuggestion = vi.fn();
    appendWelcomeMessage(log, {
      onSuggestion,
      onAction: vi.fn(),
    });

    expect(textFromTree(log)).toContain(CHATBOT_CONFIG.greeting.slice(0, 40));
    const suggestionButtons = collectDescendants(log).filter((node) =>
      node.classList.contains('chat-chip--suggestion'),
    );
    expect(suggestionButtons).toHaveLength(CHATBOT_CONFIG.suggestedQuestions.length);
    expect(suggestionButtons).toHaveLength(5);

    suggestionButtons[0]!.click();
    expect(onSuggestion).toHaveBeenCalledWith(CHATBOT_CONFIG.suggestedQuestions[0]);
  });

  it('renders user text as plain text nodes only', () => {
    const log = createMessageLog();
    appendUserMessage(log, hostileMarkupText);

    expect(collectDescendants(log).some((node) => node.tagName === 'SCRIPT')).toBe(false);
    expect(collectDescendants(log).some((node) => node.tagName === 'IMG')).toBe(false);
    const bubble = log.querySelector('.chat-msg__bubble');
    expect(bubble?.textContent).toBe(hostileMarkupText);
  });

  it('formats bot reply lines, bullets, sources, actions, and follow-ups', async () => {
    const log = createMessageLog();
    browser.setReducedMotion(true);
    const onSuggestion = vi.fn();
    const onAction = vi.fn();

    const reply = makeReply({
      text: 'Lead line\n• First bullet\n• Second bullet\nClosing line',
      sources: [
        { id: 'exp-1', label: 'Experience A' },
        { id: 'exp-2', label: 'Experience B' },
      ],
      actions: ['cv', 'email'],
      suggestions: ['What else?', 'Tell me more.'],
    });

    await appendBotMessage(
      log,
      reply,
      { onSuggestion, onAction },
      { reveal: false },
    );

    expect(log.querySelectorAll('.chat-msg__line')).toHaveLength(2);
    expect(log.querySelectorAll('.chat-msg__list li')).toHaveLength(2);
    expect(log.querySelectorAll('.chat-msg__source-chip')).toHaveLength(2);
    expect(collectDescendants(log).filter((n) => n.classList.contains('chat-chip--action'))).toHaveLength(
      2,
    );
    expect(
      collectDescendants(log).filter((n) => n.classList.contains('chat-chip--suggestion')),
    ).toHaveLength(2);

    const actionButton = log.querySelector('.chat-chip--action') as HTMLButtonElement | null;
    actionButton?.click();
    expect(onAction).toHaveBeenCalledWith('cv');

    const followUp = [...log.querySelectorAll('.chat-chip--suggestion')].find(
      (node) => node.textContent === 'What else?',
    ) as HTMLButtonElement | undefined;
    followUp?.click();
    expect(onSuggestion).toHaveBeenCalledWith('What else?');
  });

  it('escapes hostile bot reply markup into text content', async () => {
    const log = createMessageLog();
    browser.setReducedMotion(true);

    await appendBotMessage(
      log,
      makeReply({ text: hostileMarkupText, sources: [], actions: [], suggestions: [] }),
      { onSuggestion: vi.fn(), onAction: vi.fn() },
      { reveal: false },
    );

    expect(collectDescendants(log).some((node) => node.tagName === 'SCRIPT')).toBe(false);
    expect(collectDescendants(log).some((node) => node.tagName === 'IMG')).toBe(false);
    expect(textFromTree(log)).toContain('<script>');
  });

  it('skips staged reveal when reduced motion is preferred', async () => {
    const log = createMessageLog();
    browser.setReducedMotion(true);

    await appendBotMessage(
      log,
      makeReply({ text: 'Visible immediately' }),
      { onSuggestion: vi.fn(), onAction: vi.fn() },
    );

    const bubble = log.querySelector('.chat-msg__bubble');
    expect(bubble?.classList.contains('chat-msg__bubble--reveal')).toBe(false);
  });

  it('stages bubbles, sources and actions every 100ms, then all suggestions', async () => {
    const log = createMessageLog();
    browser.setReducedMotion(false);
    const completion = appendBotMessage(log, makeReply({
      bubbles: ['First', 'Second'],
      sources: [{ id: 'one', label: 'Source' }],
      actions: ['cv', 'email'],
      suggestions: ['Next?', 'More?'],
    }), { onSuggestion: vi.fn(), onAction: vi.fn() });
    expect(log.querySelectorAll('.chat-panel__typing-dots span')).toHaveLength(3);
    expect(log.querySelectorAll('.chat-msg__line')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(99);
    expect(log.querySelectorAll('.chat-msg__line')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(log.querySelectorAll('.chat-msg__line')).toHaveLength(1);
    expect(log.querySelectorAll('.chat-panel__typing-dots span')).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(100);
    expect(log.querySelectorAll('.chat-msg__line')).toHaveLength(2);
    expect(log.querySelector('.chat-panel__typing')).toBeNull();
    expect(log.querySelectorAll('.chat-msg__source-chip')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(log.querySelectorAll('.chat-msg__source-chip')).toHaveLength(1);
    expect(log.querySelectorAll('.chat-chip--action')).toHaveLength(0);
    expect(log.querySelectorAll('.chat-chip--suggestion')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    await completion;
    expect(log.querySelectorAll('.chat-chip--action')).toHaveLength(2);
    expect(log.querySelectorAll('.chat-chip--suggestion')).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a pending reveal and clears its timer', async () => {
    browser.setReducedMotion(false);
    const log = createMessageLog();
    const controller = new AbortController();
    const completion = appendBotMessage(log, makeReply(), {
      onSuggestion: vi.fn(), onAction: vi.fn(),
    }, { signal: controller.signal });
    controller.abort();
    await completion;
    expect(vi.getTimerCount()).toBe(0);
    expect(log.childElementCount).toBe(0);
  });

  it('toggles typing indicator visibility and aria-hidden', () => {
    const typing = document.createElement('div') as unknown as MockElement;
    setTypingVisible(asHtmlElement(typing), true);
    expect(typing.hidden).toBe(false);
    expect(typing.getAttribute('aria-hidden')).toBe('false');

    setTypingVisible(asHtmlElement(typing), false);
    expect(typing.hidden).toBe(true);
    expect(typing.getAttribute('aria-hidden')).toBe('true');
  });

  it('clears the message log', () => {
    const log = createMessageLog();
    appendUserMessage(log, 'hello');
    clearMessageLog(log);
    expect(log.childElementCount).toBe(0);
  });
});
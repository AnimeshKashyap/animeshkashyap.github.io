import panelCss from './panel.css?inline';
import { matchCompactMode, resolveCompactStyles } from '../compact';
import { suggest } from '../engine/suggestions';
import { runAction, type ActionContext } from '../engine/actions';
import {
  appendBotMessage,
  appendTypingMessage,
  appendUserMessage,
  appendWelcomeMessage,
  clearMessageLog,
  createMessageLog,

  type MessageHandlers,
} from './messages';
import type { ChatEngine, Reply } from '../types';

const CHATBOT_HOST_ID = 'portfolio-chatbot-host';
export const CHAT_PANEL_ID = 'portfolio-chat-panel';

const CHAT_HISTORY_STORAGE_PREFIX = 'portfolio-chatbot-history';

type HistoryEntry =
  | { kind: 'user'; text: string }
  | { kind: 'bot'; reply: Reply };

type PanelElements = {
  root: HTMLElement;
  log: HTMLElement;

  form: HTMLFormElement;
  input: HTMLInputElement;
  send: HTMLButtonElement;
  hideAutocomplete: () => void;
  handlers: MessageHandlers;
};

let panelMounted = false;
let panelVisible = false;
let panelElements: PanelElements | undefined;
let enginePromise: Promise<ChatEngine> | undefined;
let busy = false;
let pendingResponse: AbortController | undefined;
let pendingTyping: HTMLElement | undefined;
let messageHistory: HistoryEntry[] = [];
let releaseCompactViewport: (() => void) | undefined;

function lockCompactViewport(root: HTMLElement): void {
  releaseCompactViewport?.();
  if (!matchCompactMode().matches) return;
  const documentRoot = document.documentElement;
  const overflow = documentRoot.style.getPropertyValue('overflow');
  const priority = documentRoot.style.getPropertyPriority('overflow');
  documentRoot.style.setProperty('overflow', 'hidden');
  const viewport = window.visualViewport;
  const update = (): void => {
    if (!viewport) return;
    root.style.setProperty('--chat-viewport-height', `${viewport.height}px`);
    root.style.setProperty('--chat-viewport-top', `${viewport.offsetTop}px`);
  };
  update();
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  // Host removal has no framework unmount hook: release the document lock directly.
  const observer = new MutationObserver(() => {
    if (!root.isConnected) {
      releaseCompactViewport?.();
      if (panelElements) cancelResponse(panelElements);
      panelVisible = false;
      panelMounted = false;
      panelElements = undefined;
    }
  });
  observer.observe(documentRoot, { childList: true, subtree: true });
  releaseCompactViewport = () => {
    observer.disconnect();
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    if (overflow) documentRoot.style.setProperty('overflow', overflow, priority);
    else documentRoot.style.removeProperty('overflow');
    root.style.removeProperty('--chat-viewport-height');
    root.style.removeProperty('--chat-viewport-top');
    releaseCompactViewport = undefined;
  };
}

function getChatbotShadow(): ShadowRoot | null {
  const host = document.getElementById(CHATBOT_HOST_ID);
  return host?.shadowRoot ?? null;
}

function getLauncherButton(shadow: ShadowRoot): HTMLButtonElement | null {
  return shadow.querySelector<HTMLButtonElement>('button.launcher');
}

function syncLauncherExpanded(expanded: boolean): void {
  const shadow = getChatbotShadow();
  if (shadow === null) {
    return;
  }
  const launcher = getLauncherButton(shadow);
  if (launcher !== null) {
    launcher.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    launcher.setAttribute('aria-label', expanded ? 'Close chat' : 'Open chat');
  }
}

function focusLauncher(): void {
  const shadow = getChatbotShadow();
  if (shadow === null) {
    return;
  }
  const launcher = getLauncherButton(shadow);
  launcher?.focus();
}

function historyStorageKey(): string {
  const page = getPageContext().page;
  return `${CHAT_HISTORY_STORAGE_PREFIX}:${page}`;
}

type StoredReply = Omit<Reply, 'bubbles'> & { bubbles?: string[] };

function isValidReply(value: unknown): value is StoredReply {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.text === 'string' &&
    (record.bubbles === undefined ||
      (Array.isArray(record.bubbles) && record.bubbles.every((bubble) => typeof bubble === 'string'))) &&
    Array.isArray(record.sources) &&
    Array.isArray(record.actions) &&
    Array.isArray(record.suggestions) &&
    typeof record.confident === 'boolean'
  );
}

function parseStoredHistory(raw: string): HistoryEntry[] | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return null;
    }

    const entries: HistoryEntry[] = [];
    for (const item of data) {
      if (typeof item !== 'object' || item === null) {
        return null;
      }
      const record = item as Record<string, unknown>;
      if (record.kind === 'user' && typeof record.text === 'string') {
        entries.push({ kind: 'user', text: record.text });
        continue;
      }
      if (record.kind === 'bot' && isValidReply(record.reply)) {
        const bubbles = record.reply.bubbles ?? [record.reply.text];
        entries.push({
          kind: 'bot',
          reply: { ...record.reply, bubbles, text: bubbles.join('\n\n') },
        });
        continue;
      }
      return null;
    }

    return entries;
  } catch {
    return null;
  }
}

function loadMessageHistoryFromStorage(): HistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(historyStorageKey());
    if (raw === null) {
      return [];
    }
    const parsed = parseStoredHistory(raw);
    if (parsed === null) {
      sessionStorage.removeItem(historyStorageKey());
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function persistMessageHistory(): void {
  try {
    if (messageHistory.length === 0) {
      sessionStorage.removeItem(historyStorageKey());
      return;
    }
    sessionStorage.setItem(historyStorageKey(), JSON.stringify(messageHistory));
  } catch {
    // sessionStorage may be unavailable or full
  }
}

async function restoreMessageHistory(elements: PanelElements): Promise<void> {
  messageHistory = loadMessageHistoryFromStorage();
  if (messageHistory.length === 0) {
    return;
  }

  clearMessageLog(elements.log);
  for (const entry of messageHistory) {
    if (entry.kind === 'user') {
      appendUserMessage(elements.log, entry.text);
    } else {
      await appendBotMessage(elements.log, entry.reply, elements.handlers, { reveal: false });
    }
  }
}

function resetConversation(elements: PanelElements): void {
  // Reset releases the old lock; the still-open compact dialog acquires a fresh one.
  releaseCompactViewport?.();
  if (panelVisible) lockCompactViewport(elements.root);
  cancelResponse(elements);
  messageHistory = [];
  persistMessageHistory();
  clearMessageLog(elements.log);
  ensureWelcome(elements);
}

function closePanel(elements: PanelElements): void {
  releaseCompactViewport?.();
  cancelResponse(elements);
  panelVisible = false;
  setPanelHidden(elements.root, true);
  syncLauncherExpanded(false);
  focusLauncher();
}

function getPageContext(): ActionContext {
  const host = document.getElementById(CHATBOT_HOST_ID);
  const page = host?.getAttribute('data-chatbot-page');
  if (page === 'v4') {
    return { page: 'v4' };
  }
  return { page: 'main' };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function createIconButton(className: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.setAttribute('data-tooltip', label);
  return button;
}

function createRotateCcwIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const stroke = {
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };

  const arc = document.createElementNS(SVG_NS, 'path');
  arc.setAttribute('d', 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8');
  for (const [name, value] of Object.entries(stroke)) {
    arc.setAttribute(name, value);
  }

  const arrow = document.createElementNS(SVG_NS, 'path');
  arrow.setAttribute('d', 'M3 3v5h5');
  for (const [name, value] of Object.entries(stroke)) {
    arrow.setAttribute(name, value);
  }

  svg.append(arc, arrow);
  return svg;
}

function loadEngine(): Promise<ChatEngine> {
  enginePromise ??= import('../engine').then(({ createEngine }) => createEngine());
  return enginePromise;
}

function updateSendDisabled(input: HTMLInputElement, send: HTMLButtonElement): void {
  const hasText = input.value.trim().length > 0;
  send.disabled = !hasText || busy;
}

function setPanelHidden(root: HTMLElement, hidden: boolean): void {
  if (hidden) {
    root.setAttribute('hidden', '');
  } else {
    root.removeAttribute('hidden');
  }
}

function focusInput(input: HTMLInputElement): void {
  input.focus();
}

function ensureWelcome(elements: PanelElements): void {
  if (elements.log.childElementCount === 0) {
    appendWelcomeMessage(elements.log, elements.handlers);
  }
}

function cancelResponse(elements: PanelElements): void {
  elements.hideAutocomplete();
  pendingResponse?.abort();
  pendingResponse = undefined;
  if (pendingTyping) pendingTyping.parentNode?.removeChild(pendingTyping);
  pendingTyping = undefined;
  busy = false;
  elements.input.disabled = false;
  updateSendDisabled(elements.input, elements.send);
}

async function handleQuery(elements: PanelElements, query: string): Promise<void> {
  if (busy) {
    return;
  }
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return;
  }

  busy = true;
  elements.hideAutocomplete();
  const controller = new AbortController();
  pendingResponse = controller;
  elements.input.disabled = true;
  updateSendDisabled(elements.input, elements.send);

  appendUserMessage(elements.log, trimmed);
  messageHistory.push({ kind: 'user', text: trimmed });
  persistMessageHistory();
  elements.input.value = '';
  updateSendDisabled(elements.input, elements.send);
  const typing = appendTypingMessage(elements.log);
  pendingTyping = typing;

  try {
    const engine = await loadEngine();
    if (controller.signal.aborted) return;
    const reply = await engine.ask(trimmed);
    if (controller.signal.aborted) return;
    typing.parentNode?.removeChild(typing);
    pendingTyping = undefined;
    await appendBotMessage(elements.log, reply, elements.handlers, { signal: controller.signal });
    if (controller.signal.aborted) return;
    messageHistory.push({ kind: 'bot', reply });
    persistMessageHistory();
  } finally {
    typing.parentNode?.removeChild(typing);
    if (pendingResponse === controller) {
      cancelResponse(elements);
      focusInput(elements.input);
    }
  }
}

async function handleSend(elements: PanelElements): Promise<void> {
  await handleQuery(elements, elements.input.value);
}

function mountPanel(shadow: ShadowRoot): PanelElements {
  const style = document.createElement('style');
  style.textContent = resolveCompactStyles(panelCss);
  shadow.appendChild(style);


  const root = document.createElement('div');
  root.id = CHAT_PANEL_ID;
  root.className = 'chat-panel';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'chat-panel-title');
  root.setAttribute('hidden', '');

  const header = document.createElement('header');
  header.className = 'chat-panel__header';

  const title = document.createElement('h2');
  title.id = 'chat-panel-title';
  title.className = 'chat-panel__title';
  title.textContent = 'Portfolio assistant';

  const actions = document.createElement('div');
  actions.className = 'chat-panel__actions';

  const clearBtn = createIconButton('chat-panel__icon-btn', 'Reset chat');
  clearBtn.appendChild(createRotateCcwIcon());

  const closeBtn = createIconButton('chat-panel__icon-btn', 'Close chat');
  closeBtn.textContent = '×';

  actions.append(clearBtn, closeBtn);
  header.append(title, actions);

  const body = document.createElement('div');
  body.className = 'chat-panel__body';

  const log = createMessageLog();




  const form = document.createElement('form');
  form.className = 'chat-panel__form';
  form.setAttribute('aria-label', 'Send a message');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-panel__input';
  input.name = 'message';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Message');
  input.placeholder = 'Ask about experience, skills, projects…';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'chat-input-suggestions');

  const list = document.createElement('div');
  list.id = 'chat-input-suggestions';
  list.className = 'chat-panel__autocomplete';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suggested questions');
  list.hidden = true;

  let focused = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let options: HTMLButtonElement[] = [];
  let highlighted = -1;

  function highlight(index: number): void {
    highlighted = index;
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    if (options[index]) input.setAttribute('aria-activedescendant', options[index].id);
    else input.removeAttribute('aria-activedescendant');
  }

  function hideAutocomplete(): void {
    clearTimeout(timer);
    timer = undefined;
    highlight(-1);
    options = [];
    list.replaceChildren();
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  function scheduleAutocomplete(): void {
    hideAutocomplete();
    if (!focused || busy || !panelVisible || !input.value.trim()) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!focused || busy || !panelVisible) return;
      options = suggest(input.value, 3).map((sentence, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.tabIndex = -1;
        option.id = `chat-input-suggestion-${index}`;
        option.className = 'chat-panel__option';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.textContent = sentence;
        // Keep focus on the combobox so blur does not swallow pointer clicks.
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('mouseenter', () => highlight(index));
        option.addEventListener('click', () => { void handleQuery(elements, sentence); });
        return option;
      });
      list.replaceChildren(...options);
      list.hidden = options.length === 0;
      input.setAttribute('aria-expanded', String(options.length > 0));
    }, 80);
  }

  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'chat-panel__send';
  send.setAttribute('aria-label', 'Send message');
  send.textContent = 'Send';
  send.disabled = true;

  form.append(input, send);

  const elements: PanelElements = {
    root,
    log,

    form,
    input,
    send,
    hideAutocomplete,
    handlers: {
      onSuggestion: () => {},
      onAction: () => {},
    },
  };

  elements.handlers = {
    onSuggestion: (query) => {
      void handleQuery(elements, query);
    },
    onAction: (id) => {
      runAction(id, getPageContext());
    },
  };

  body.append(log, list, form);
  root.append(header, body);
  shadow.appendChild(root);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSend(elements);
  });

  input.addEventListener('input', () => {
    updateSendDisabled(input, send);
    scheduleAutocomplete();
  });
  input.addEventListener('focus', () => {
    focused = true;
    scheduleAutocomplete();
  });
  input.addEventListener('blur', () => {
    focused = false;
    hideAutocomplete();
  });
  input.addEventListener('keydown', (event) => {
    if (event.isComposing || list.hidden) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(highlighted < 0
        ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
        : (highlighted + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
    } else if (highlighted >= 0 && event.key === 'Enter') {
      event.preventDefault();
      void handleQuery(elements, options[highlighted].textContent ?? '');
    } else if (highlighted >= 0 && (event.key === 'Tab' && !event.shiftKey
      || event.key === 'ArrowRight' && input.selectionStart === input.value.length
        && input.selectionEnd === input.value.length)) {
      event.preventDefault();
      input.value = options[highlighted].textContent ?? '';
      hideAutocomplete();
      updateSendDisabled(input, send);
    }
  });

  clearBtn.addEventListener('click', () => {
    resetConversation(elements);
    focusInput(input);
  });

  closeBtn.addEventListener('click', () => {
    closePanel(elements);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!list.hidden) {
        hideAutocomplete();
        return;
      }
      closePanel(elements);
    }
  });

  void restoreMessageHistory(elements).then(() => {
    if (elements.log.childElementCount === 0) {
      ensureWelcome(elements);
    }
  });

  return elements;
}

function showPanel(elements: PanelElements): void {
  lockCompactViewport(elements.root);
  panelVisible = true;
  setPanelHidden(elements.root, false);
  syncLauncherExpanded(true);
  if (elements.log.childElementCount === 0) {
    ensureWelcome(elements);
  }
  focusInput(elements.input);
}

/** Opens (or restores) the chat panel inside the launcher shadow root. */
export function openPanel(): void {
  const shadow = getChatbotShadow();
  if (shadow === null) {
    return;
  }

  if (!panelMounted) {
    panelElements = mountPanel(shadow);
    panelMounted = true;
    void loadEngine();
  }

  if (panelElements === undefined) {
    return;
  }

  if (!panelVisible) {
    showPanel(panelElements);
  }
}

/** Whether the chat panel is currently open. */
export function isPanelOpen(): boolean {
  return panelVisible;
}

/** Opens the panel when closed; closes via the same path as the header Close control when open. */
export function togglePanel(): void {
  const shadow = getChatbotShadow();
  if (shadow === null) {
    return;
  }

  if (!panelMounted) {
    panelElements = mountPanel(shadow);
    panelMounted = true;
    void loadEngine();
  }

  if (panelElements === undefined) {
    return;
  }

  if (panelVisible) {
    closePanel(panelElements);
    return;
  }

  showPanel(panelElements);
}
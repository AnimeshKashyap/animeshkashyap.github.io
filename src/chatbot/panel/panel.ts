import panelCss from './panel.css?inline';
import { CHATBOT_CONFIG } from '../config';
import { runAction, type ActionContext } from '../engine/actions';
import type { ActionId } from '../types';
import {
  appendBotMessage,
  appendUserMessage,
  appendWelcomeMessage,
  clearMessageLog,
  createMessageLog,
  setTypingVisible,
  type MessageHandlers,
} from './messages';
import type { ChatEngine } from '../types';

const CHATBOT_HOST_ID = 'portfolio-chatbot-host';
export const CHAT_PANEL_ID = 'portfolio-chat-panel';

const QUICK_ACTION_IDS: ActionId[] = ['cv', 'email', 'linkedin', 'github', 'projects'];

type PanelElements = {
  root: HTMLElement;
  log: HTMLElement;
  typing: HTMLElement;
  form: HTMLFormElement;
  input: HTMLInputElement;
  send: HTMLButtonElement;
  minimizeBtn: HTMLButtonElement;
  handlers: MessageHandlers;
};

let panelMounted = false;
let panelVisible = false;
let panelMinimized = false;
let panelElements: PanelElements | undefined;
let enginePromise: Promise<ChatEngine> | undefined;
let busy = false;

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
  }
}

function getPageContext(): ActionContext {
  const host = document.getElementById(CHATBOT_HOST_ID);
  const page = host?.getAttribute('data-chatbot-page');
  if (page === 'v4') {
    return { page: 'v4' };
  }
  return { page: 'main' };
}

function createIconButton(className: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  return button;
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

function setMinimized(root: HTMLElement, minimized: boolean): void {
  root.classList.toggle('chat-panel--minimized', minimized);
}

function focusInput(input: HTMLInputElement): void {
  input.focus();
}

function ensureWelcome(elements: PanelElements): void {
  if (elements.log.childElementCount === 0) {
    appendWelcomeMessage(elements.log, elements.handlers);
  }
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
  elements.input.disabled = true;
  updateSendDisabled(elements.input, elements.send);

  appendUserMessage(elements.log, trimmed);
  elements.input.value = '';
  updateSendDisabled(elements.input, elements.send);
  setTypingVisible(elements.typing, true);

  try {
    const engine = await loadEngine();
    const reply = await engine.ask(trimmed);
    appendBotMessage(elements.log, reply, elements.handlers);
  } finally {
    setTypingVisible(elements.typing, false);
    busy = false;
    elements.input.disabled = false;
    updateSendDisabled(elements.input, elements.send);
    focusInput(elements.input);
  }
}

async function handleSend(elements: PanelElements): Promise<void> {
  await handleQuery(elements, elements.input.value);
}

function mountQuickActionBar(page: ActionContext): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'chat-panel__quick-actions';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Quick actions');

  for (const id of QUICK_ACTION_IDS) {
    const config = CHATBOT_CONFIG.actions[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-chip chat-chip--quick';
    button.textContent = config.label;
    button.addEventListener('click', () => {
      runAction(id, page);
    });
    bar.appendChild(button);
  }

  return bar;
}

function mountPanel(shadow: ShadowRoot): PanelElements {
  const style = document.createElement('style');
  style.textContent = panelCss;
  shadow.appendChild(style);

  const page = getPageContext();

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

  const minimizeBtn = createIconButton('chat-panel__icon-btn', 'Minimize chat');
  minimizeBtn.textContent = '−';

  const clearBtn = createIconButton('chat-panel__icon-btn', 'Clear conversation');
  clearBtn.textContent = '⌫';

  const closeBtn = createIconButton('chat-panel__icon-btn', 'Close chat');
  closeBtn.textContent = '×';

  actions.append(minimizeBtn, clearBtn, closeBtn);
  header.append(title, actions);

  const body = document.createElement('div');
  body.className = 'chat-panel__body';

  const log = createMessageLog();

  const typing = document.createElement('div');
  typing.className = 'chat-panel__typing';
  typing.hidden = true;
  typing.setAttribute('aria-hidden', 'true');

  const typingLabel = document.createElement('span');
  typingLabel.textContent = 'Assistant is typing';
  const dots = document.createElement('span');
  dots.className = 'chat-panel__typing-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) {
    dots.appendChild(document.createElement('span'));
  }
  typing.append(typingLabel, dots);

  const quickActions = mountQuickActionBar(page);

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
    typing,
    form,
    input,
    send,
    minimizeBtn,
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

  body.append(log, typing, quickActions, form);
  root.append(header, body);
  shadow.appendChild(root);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSend(elements);
  });

  input.addEventListener('input', () => {
    updateSendDisabled(input, send);
  });

  minimizeBtn.addEventListener('click', () => {
    panelMinimized = !panelMinimized;
    setMinimized(root, panelMinimized);
    const ariaLabel = panelMinimized ? 'Restore chat' : 'Minimize chat';
    minimizeBtn.setAttribute('aria-label', ariaLabel);
    if (!panelMinimized) {
      focusInput(input);
    }
  });

  clearBtn.addEventListener('click', () => {
    if (busy) {
      return;
    }
    clearMessageLog(log);
    ensureWelcome(elements);
    focusInput(input);
  });

  closeBtn.addEventListener('click', () => {
    panelVisible = false;
    panelMinimized = false;
    setMinimized(root, false);
    setPanelHidden(root, true);
    syncLauncherExpanded(false);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeBtn.click();
    }
  });

  ensureWelcome(elements);

  return elements;
}

function showPanel(elements: PanelElements): void {
  panelVisible = true;
  setPanelHidden(elements.root, false);
  syncLauncherExpanded(true);
  if (panelMinimized) {
    panelMinimized = false;
    setMinimized(elements.root, false);
    elements.minimizeBtn.setAttribute('aria-label', 'Minimize chat');
  }
  ensureWelcome(elements);
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
    return;
  }

  if (panelMinimized) {
    panelMinimized = false;
    setMinimized(panelElements.root, false);
    panelElements.minimizeBtn.setAttribute('aria-label', 'Minimize chat');
    focusInput(panelElements.input);
  }
}
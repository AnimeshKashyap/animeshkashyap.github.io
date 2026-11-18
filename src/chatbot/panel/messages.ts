import { CHATBOT_CONFIG, CHATBOT_KEYWORDS } from '../config';
import type { ActionId, Reply } from '../types';

export type MessageHandlers = {
  onSuggestion: (query: string) => void;
  onAction: (id: ActionId) => void;
};

export type AppendBotMessageOptions = {
  reveal?: boolean;
  signal?: AbortSignal;
};

const REVEAL_DELAY_MS = 500;
const FOLLOW_UP_DELAY_MS = 1000;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function delay(signal?: AbortSignal, ms: number = REVEAL_DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = window.setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) finish();
  });
}

export function appendTypingMessage(log: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'chat-msg chat-msg--bot chat-panel__typing';
  row.setAttribute('aria-label', 'Assistant is typing');
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg__bubble';
  const dots = document.createElement('span');
  dots.className = 'chat-panel__typing-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index += 1) {
    dots.appendChild(document.createElement('span'));
  }
  bubble.appendChild(dots);
  row.appendChild(bubble);
  log.appendChild(row);
  scrollLogToBottom(log);
  return row;
}

function scrollLogToBottom(log: HTMLElement): void {
  log.scrollTop = log.scrollHeight;
}

function appendFormattedText(parent: HTMLElement, text: string): void {
  const lines = text.split('\n');
  let list: HTMLUListElement | null = null;

  const flushList = (): void => {
    if (list !== null) {
      parent.appendChild(list);
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      flushList();
      continue;
    }

    const bulletPrefix = '• ';
    if (line.startsWith(bulletPrefix)) {
      if (list === null) {
        list = document.createElement('ul');
        list.className = 'chat-msg__list';
      }
      const item = document.createElement('li');
      item.textContent = line.slice(bulletPrefix.length);
      list.appendChild(item);
      continue;
    }

    if (line.startsWith('•')) {
      if (list === null) {
        list = document.createElement('ul');
        list.className = 'chat-msg__list';
      }
      const item = document.createElement('li');
      item.textContent = line.slice(1).trimStart();
      list.appendChild(item);
      continue;
    }

    flushList();
    const paragraph = document.createElement('p');
    paragraph.className = 'chat-msg__line';
    paragraph.textContent = line;
    parent.appendChild(paragraph);
  }

  flushList();
}

function createChipRow(className: string, ariaLabel: string): HTMLElement {
  const row = document.createElement('div');
  row.className = className;
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', ariaLabel);
  return row;
}

function createChipButton(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export function createMessageLog(): HTMLElement {
  const log = document.createElement('div');
  log.className = 'chat-panel__log';
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-relevant', 'additions');
  log.setAttribute('tabindex', '0');
  return log;
}

export function clearMessageLog(log: HTMLElement): void {
  log.replaceChildren();
}

export function appendWelcomeMessage(log: HTMLElement, handlers: MessageHandlers): void {
  const row = document.createElement('div');
  row.className = 'chat-msg chat-msg--bot';

  const bubble = document.createElement('div');
  bubble.className = 'chat-msg__bubble';
  appendFormattedText(bubble, CHATBOT_CONFIG.greeting);

  row.appendChild(bubble);

  const suggestions = createChipRow('chat-msg__chips', 'Suggested questions');
  for (const { label, query } of CHATBOT_KEYWORDS) {
    suggestions.appendChild(
      createChipButton(label, 'chat-chip chat-chip--suggestion', () => {
        handlers.onSuggestion(query);
      }),
    );
  }

  row.appendChild(suggestions);
  log.appendChild(row);
  scrollLogToBottom(log);
}

export function appendUserMessage(log: HTMLElement, text: string): void {
  const row = document.createElement('div');
  row.className = 'chat-msg chat-msg--user';

  const bubble = document.createElement('div');
  bubble.className = 'chat-msg__bubble';
  bubble.textContent = text;

  row.appendChild(bubble);
  log.appendChild(row);
  scrollLogToBottom(log);
}

function appendBotExtras(
  row: HTMLElement,
  reply: Reply,
  handlers: MessageHandlers,
): void {
  if (reply.sources.length > 0) {
    const sources = document.createElement('div');
    sources.className = 'chat-msg__sources';
    sources.setAttribute('aria-label', 'Sources');

    for (const source of reply.sources) {
      const chip = document.createElement('span');
      chip.className = 'chat-msg__source-chip';
      chip.textContent = source.label;
      chip.title = source.id;
      sources.appendChild(chip);
    }

    row.appendChild(sources);
  }

  if (reply.actions.length > 0) {
    const actions = createChipRow('chat-msg__chips', 'Actions for this reply');
    for (const actionId of reply.actions) {
      const config = CHATBOT_CONFIG.actions[actionId];
      actions.appendChild(
        createChipButton(config.label, 'chat-chip chat-chip--action', () => {
          handlers.onAction(actionId);
        }),
      );
    }
    row.appendChild(actions);
  }

  if (reply.suggestions.length > 0) {
    const followUps = createChipRow('chat-msg__chips', 'Suggested follow-up questions');
    for (const question of reply.suggestions) {
      followUps.appendChild(
        createChipButton(question, 'chat-chip chat-chip--suggestion', () => {
          handlers.onSuggestion(CHATBOT_KEYWORDS.find(({ label }) => label === question)?.query ?? question);
        }),
      );
    }
    row.appendChild(followUps);
  }
}

export async function appendBotMessage(
  log: HTMLElement,
  reply: Reply,
  handlers: MessageHandlers,
  options: AppendBotMessageOptions = {},
): Promise<void> {
  const staged = options.reveal !== false && !prefersReducedMotion();
  const { signal } = options;
  if (signal?.aborted) return;
  const extras = document.createElement('div');
  appendBotExtras(extras, reply, handlers);
  const groups = [...extras.children];
  const label = (group: Element): string | null => group.getAttribute('aria-label');
  // Source chips are informational and belong to the start of the message.
  const sourcesGroup = groups.find((group) => label(group) === 'Sources');
  const followUps = groups.find((group) => label(group) === 'Suggested follow-up questions');
  const newRow = (): HTMLElement => {
    const created = document.createElement('div');
    created.className = 'chat-msg chat-msg--bot';
    log.appendChild(created);
    return created;
  };
  const pause = async (ms: number): Promise<void> => {
    const typing = appendTypingMessage(log);
    await delay(signal, ms);
    typing.parentNode?.removeChild(typing);
  };
  let row: HTMLElement | undefined;
  let leading: HTMLElement | undefined;
  if (sourcesGroup) {
    if (staged) await pause(REVEAL_DELAY_MS);
    if (signal?.aborted) return;
    leading = newRow();
    row = leading;
    if (staged) sourcesGroup.classList.add('chat-msg--enter');
    row.appendChild(sourcesGroup);
    scrollLogToBottom(log);
  }
  for (const text of reply.bubbles ?? [reply.text]) {
    if (staged) await pause(REVEAL_DELAY_MS);
    if (signal?.aborted) return;
    row = leading ?? newRow();
    leading = undefined;
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg__bubble';
    appendFormattedText(bubble, text);
    if (staged) bubble.classList.add('chat-msg--enter');
    row.appendChild(bubble);
    scrollLogToBottom(log);
  }
  row ??= newRow();
  for (const group of groups) {
    if (group === sourcesGroup || group === followUps) continue;
    if (staged) await pause(REVEAL_DELAY_MS);
    if (signal?.aborted) return;
    if (staged) group.classList.add('chat-msg--enter');
    row.appendChild(group);
    scrollLogToBottom(log);
  }
  if (followUps) {
    if (staged) await pause(FOLLOW_UP_DELAY_MS);
    if (signal?.aborted) return;
    if (staged) followUps.classList.add('chat-msg--enter');
    row.appendChild(followUps);
    scrollLogToBottom(log);
  }
}

export function setTypingVisible(typingEl: HTMLElement, visible: boolean): void {
  typingEl.hidden = !visible;
  typingEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
}
import { CHATBOT_CONFIG } from '../config';
import type { ActionId, Reply } from '../types';

export type MessageHandlers = {
  onSuggestion: (query: string) => void;
  onAction: (id: ActionId) => void;
};

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
  for (const question of CHATBOT_CONFIG.suggestedQuestions) {
    suggestions.appendChild(
      createChipButton(question, 'chat-chip chat-chip--suggestion', () => {
        handlers.onSuggestion(question);
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

export function appendBotMessage(
  log: HTMLElement,
  reply: Reply,
  handlers: MessageHandlers,
): void {
  const row = document.createElement('div');
  row.className = 'chat-msg chat-msg--bot';

  const bubble = document.createElement('div');
  bubble.className = 'chat-msg__bubble';
  appendFormattedText(bubble, reply.text);

  row.appendChild(bubble);

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
          handlers.onSuggestion(question);
        }),
      );
    }
    row.appendChild(followUps);
  }

  log.appendChild(row);
  scrollLogToBottom(log);
}

export function setTypingVisible(typingEl: HTMLElement, visible: boolean): void {
  typingEl.hidden = !visible;
  typingEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
}
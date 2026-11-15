import type { Reply } from '../types';

function scrollLogToBottom(log: HTMLElement): void {
  log.scrollTop = log.scrollHeight;
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

export function appendBotMessage(log: HTMLElement, reply: Reply): void {
  const row = document.createElement('div');
  row.className = 'chat-msg chat-msg--bot';

  const bubble = document.createElement('div');
  bubble.className = 'chat-msg__bubble';
  bubble.textContent = reply.text;

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

  log.appendChild(row);
  scrollLogToBottom(log);
}

export function setTypingVisible(typingEl: HTMLElement, visible: boolean): void {
  typingEl.hidden = !visible;
  typingEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
}
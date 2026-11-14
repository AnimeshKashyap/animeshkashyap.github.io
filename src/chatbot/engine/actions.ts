import { CHATBOT_CONFIG } from '../config';
import type { ActionId } from '../types';

export type ActionContext = {
  page: 'main' | 'v4';
};

function openInNewTab(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.click();
}

function triggerDownload(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  const fileName = url.split('/').pop();
  if (fileName !== undefined && fileName.length > 0) {
    anchor.download = fileName;
  }
  anchor.click();
}

function openMailto(url: string): void {
  window.location.href = url;
}

function goToProjects(page: ActionContext['page'], url: string): void {
  if (page === 'main') {
    const target = document.getElementById('projects');
    if (target !== null) {
      target.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    window.location.hash = 'projects';
    return;
  }

  window.location.assign(url);
}

/** Execute a configured chat action. Sole module allowed to touch `window` / `location`. */
export function runAction(id: ActionId, ctx: ActionContext): void {
  const action = CHATBOT_CONFIG.actions[id];

  switch (action.kind) {
    case 'open':
      openInNewTab(action.url);
      break;
    case 'download':
      triggerDownload(action.url);
      break;
    case 'mailto':
      openMailto(action.url);
      break;
    case 'scroll':
      goToProjects(ctx.page, action.url);
      break;
  }
}
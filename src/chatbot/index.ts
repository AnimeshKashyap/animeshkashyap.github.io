import { matchCompactMode } from './compact';
import { mountLauncher } from './launcher';

export type ChatbotPage = 'main' | 'v4';

const CHATBOT_HOST_ID = 'portfolio-chatbot-host';

/** Removes the page cover index.html shows on compact screens while the chat loads. The chat sits above it and fades in over 320ms, so waiting that long means the page is never visible. */
function releaseBootCover(afterMs = 0): void {
  const root = document.documentElement;
  if (!root.classList.contains('chatbot-booting')) return;
  setTimeout(() => root.classList.remove('chatbot-booting'), afterMs);
}

export function mountChatbot({ page }: { page: ChatbotPage }): void {
  if (document.getElementById(CHATBOT_HOST_ID) !== null) {
    releaseBootCover();
    return;
  }

  const host = document.createElement('div');
  host.id = CHATBOT_HOST_ID;
  host.setAttribute('data-chatbot-page', page);
  document.body.appendChild(host);

  // Mobile/compact screens open the chat by default: start loading the panel before the launcher
  // mounts, then crossfade in without focusing the input (no keyboard pop-up).
  const panelModule = matchCompactMode().matches ? import('./panel/panel') : undefined;

  mountLauncher(host, page);

  void (panelModule?.then(({ openPanel }) => openPanel({ focus: false, fade: true })) ?? Promise.resolve())
    .then(() => releaseBootCover(350), () => releaseBootCover());
}

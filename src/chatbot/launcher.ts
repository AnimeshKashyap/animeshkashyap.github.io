import { CHATBOT_CONFIG } from './config';
import { createDock, dockStyles } from './dock';

const LAUNCHER_BUBBLE_SESSION_KEY = 'portfolio-chatbot-launcher-bubble-seen';
const LAUNCHER_BUBBLE_AUTO_HIDE_MS = 8000;

const LAUNCHER_STYLE_BODY = `
.launcher-wrap {
  position: fixed;
  left: max(16px, env(safe-area-inset-left, 0px));
  bottom: max(16px, env(safe-area-inset-bottom, 0px));
  z-index: 30;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-start;
  gap: 10px;
  pointer-events: none;
}

.launcher-wrap > * {
  pointer-events: auto;
}

.launcher {
  position: relative;
  left: auto;
  bottom: auto;
  z-index: auto;
  box-sizing: border-box;
  width: 56px;
  height: 56px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(
    --accent-gradient,
    linear-gradient(120deg, var(--accent-cyan, #5eead4), var(--accent-violet, #a78bfa))
  );
  box-shadow: var(--shadow-card, 0 20px 60px rgba(0, 0, 0, 0.35));
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    filter 180ms ease;
  animation: launcher-idle 4s ease-in-out infinite;
}

.launcher:hover {
  transform: translateY(-3px) scale(1.05);
  box-shadow:
    var(--shadow-card, 0 20px 60px rgba(0, 0, 0, 0.35)),
    0 12px 28px rgba(0, 0, 0, 0.22);
  filter: brightness(1.08);
}

.launcher:active {
  transform: translateY(-1px) scale(0.98);
}

.launcher:focus-visible {
  outline: 2px solid var(--accent-cyan, #5eead4);
  outline-offset: 3px;
}

.launcher__icon {
  width: 26px;
  height: 26px;
  display: block;
  flex-shrink: 0;
}

.launcher-bubble {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: max(200px, min(260px, calc(100vw - 32px - 56px - 20px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))));
  max-width: min(260px, calc(100vw - 32px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  margin: 0;
  padding: 10px 10px 10px 12px;
  border-radius: var(--radius-md, 14px);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  font-family: var(--font-body, 'Inter', system-ui, sans-serif);
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-primary, #eef1f8);
  background: var(--bg-raised, #0b0f1a);
  box-shadow: var(--shadow-card, 0 20px 60px rgba(0, 0, 0, 0.35));
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 200ms ease,
    transform 200ms ease,
    visibility 200ms allow-discrete;
}

.launcher-bubble[hidden] {
  display: none;
  opacity: 0;
  transform: translateY(6px);
  visibility: hidden;
}

@starting-style {
  .launcher-bubble:not([hidden]) {
    opacity: 0;
    transform: translateY(6px);
  }
}

.launcher-bubble__text {
  flex: 1;
  margin: 0;
  min-width: 0;
}

.launcher-bubble__dismiss {
  flex-shrink: 0;
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  color: var(--text-secondary, #9aa3b8);
  background: transparent;
  transition: background 120ms ease, color 120ms ease;
}

.launcher-bubble__dismiss:hover {
  color: var(--text-primary, #eef1f8);
  background: var(--bg-card, rgba(255, 255, 255, 0.06));
}

.launcher-bubble__dismiss:focus-visible {
  outline: 2px solid var(--accent-cyan, #5eead4);
  outline-offset: 2px;
}

@keyframes launcher-idle {
  0%,
  100% {
    box-shadow: var(--shadow-card, 0 20px 60px rgba(0, 0, 0, 0.35));
  }
  50% {
    box-shadow:
      0 24px 64px rgba(0, 0, 0, 0.4),
      0 0 20px color-mix(in srgb, var(--accent-violet, #a78bfa) 22%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .launcher {
    animation: none;
    transition: none;
  }

  .launcher:hover,
  .launcher:active {
    transform: none;
    filter: none;
  }

  .launcher-bubble {
    transition: none;
  }

  @starting-style {
    .launcher-bubble:not([hidden]) {
      opacity: 1;
      transform: none;
    }
  }
}
`;

const CHAT_ICON_SVG = `<svg class="launcher__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
  <path d="M7.5 8.25h9m-9 3H12m-6.75 9.75 1.664.89 2.23.596.09.055.199-.055 1.664-.89H18a2.25 2.25 0 0 0 2.25-2.25V7.5A2.25 2.25 0 0 0 18 5.25H6A2.25 2.25 0 0 0 3.75 7.5v9.75A2.25 2.25 0 0 0 6 20.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function launcherHostStyles(page: 'main' | 'v4'): string {
  if (page === 'v4') {
    return `:host {
  all: initial;
  color-scheme: dark;
  --bg-raised: #10131f;
  --bg-card: rgba(255, 255, 255, 0.08);
  --border: rgba(255, 255, 255, 0.12);
  --text-primary: #eef1fa;
  --text-secondary: #a6adc4;
  --accent-cyan: #3b82f6;
  --accent-violet: #60a5fa;
  --accent-gradient: linear-gradient(120deg, var(--accent-cyan), var(--accent-violet));
  --shadow-card: 0 8px 24px rgba(0, 0, 0, 0.4);
  --radius-md: 14px;
}
`;
  }
  return `:host {
  all: initial;
}
`;
}

export function buildLauncherStyles(page: 'main' | 'v4'): string {
  return `${launcherHostStyles(page)}${LAUNCHER_STYLE_BODY}${dockStyles}`;
}

function launcherBubbleSeen(): boolean {
  try {
    return sessionStorage.getItem(LAUNCHER_BUBBLE_SESSION_KEY) === '1';
  } catch {
    return true;
  }
}

function markLauncherBubbleSeen(): void {
  try {
    sessionStorage.setItem(LAUNCHER_BUBBLE_SESSION_KEY, '1');
  } catch {
    // sessionStorage may be unavailable
  }
}

type LauncherBubbleState = {
  bubble: HTMLElement;
  autoHideId: ReturnType<typeof setTimeout> | undefined;
};

function hideLauncherBubble(state: LauncherBubbleState): void {
  if (state.autoHideId !== undefined) {
    clearTimeout(state.autoHideId);
    state.autoHideId = undefined;
  }
  state.bubble.setAttribute('hidden', '');
  markLauncherBubbleSeen();
}

function maybeMountLauncherBubble(wrap: HTMLElement): LauncherBubbleState | undefined {
  if (launcherBubbleSeen()) {
    return undefined;
  }

  const bubble = document.createElement('aside');
  bubble.className = 'launcher-bubble';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');

  const text = document.createElement('p');
  text.className = 'launcher-bubble__text';
  text.textContent = CHATBOT_CONFIG.launcherBubbleText;

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'launcher-bubble__dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss assistant hint');
  dismiss.textContent = '×';

  bubble.append(text, dismiss);
  wrap.appendChild(bubble);
  markLauncherBubbleSeen();

  const state: LauncherBubbleState = { bubble, autoHideId: undefined };

  const dismissBubble = (): void => {
    hideLauncherBubble(state);
  };

  dismiss.addEventListener('click', dismissBubble);

  state.autoHideId = setTimeout(dismissBubble, LAUNCHER_BUBBLE_AUTO_HIDE_MS);
  return state;
}

export function mountLauncher(host: HTMLElement, page: 'main' | 'v4'): HTMLButtonElement {
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = buildLauncherStyles(page);
  shadow.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'launcher-wrap';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'launcher';
  button.setAttribute('aria-label', 'Open chat');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'portfolio-chat-panel');
  button.innerHTML = CHAT_ICON_SVG;

  const bubbleState = maybeMountLauncherBubble(wrap);

  button.addEventListener('click', () => {
    if (bubbleState !== undefined && !bubbleState.bubble.hasAttribute('hidden')) {
      hideLauncherBubble(bubbleState);
    } else if (!launcherBubbleSeen()) {
      markLauncherBubbleSeen();
    }
    void import('./panel/panel').then(({ togglePanel }) => {
      togglePanel();
    });
  });

  wrap.appendChild(button);
  wrap.appendChild(createDock(page));
  shadow.appendChild(wrap);
  return button;
}
import { matchCompactMode, resolveCompactStyles } from './compact';
import { CHATBOT_CONFIG } from './config';
import { createDock, dockStyles } from './dock';

const LAUNCHER_BUBBLE_SESSION_KEY = 'portfolio-chatbot-launcher-bubble-seen';
const LAUNCHER_BUBBLE_AUTO_HIDE_MS = 8000;

const LAUNCHER_STYLE_BODY = `
:host {
  --side-left: max(16px, env(safe-area-inset-left, 0px));
  --side-right: auto;
  --side-offset: max(16px, env(safe-area-inset-left, 0px));
  --opposite-offset: max(16px, env(safe-area-inset-right, 0px));
  --side-sign: 1;
  --side-align: flex-start;
  --tip-left: calc(100% + 8px);
  --tip-right: auto;
  --tip-origin: 0%;
}
:host([data-side=right]) {
  --side-left: auto;
  --side-right: max(16px, env(safe-area-inset-right, 0px));
  --side-offset: max(16px, env(safe-area-inset-right, 0px));
  --opposite-offset: max(16px, env(safe-area-inset-left, 0px));
  --side-sign: -1;
  --side-align: flex-end;
  --tip-left: auto;
  --tip-right: calc(100% + 8px);
  --tip-origin: 100%;
}
.launcher-wrap {
  position: fixed;
  left: var(--side-left);
  right: var(--side-right);
  bottom: max(16px, env(safe-area-inset-bottom, 0px));
  z-index: 30;
  display: flex;
  flex-direction: column-reverse;
  align-items: var(--side-align);
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
  transform: translateY(-3px);
  box-shadow:
    var(--shadow-card, 0 20px 60px rgba(0, 0, 0, 0.35)),
    0 12px 28px rgba(0, 0, 0, 0.22);
  filter: brightness(1.08);
}

.launcher:active {
  transform: translateY(-1px);
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

.launcher::after {
  content: attr(aria-label);
  position: absolute;
  left: var(--tip-left);
  right: var(--tip-right);
  top: 50%;
  transform: translateY(-50%);
  box-sizing: border-box;
  width: max-content;
  max-width: max(0px, calc(100vw - var(--side-offset) - var(--opposite-offset) - 64px));
  overflow-wrap: anywhere;
  padding: 5px 8px;
  border-radius: 6px;
  font: 12px var(--font-body, system-ui, sans-serif);
  color: var(--text-primary, #eef1f8);
  background: var(--bg-raised, #0b0f1a);
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
}
.launcher:hover::after, .launcher:focus-visible::after { opacity: 1; }

.launcher-bubble {
  position: absolute;
  left: var(--tip-left);
  right: var(--tip-right);
  bottom: 28px;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 260px;
  max-width: max(0px, calc(100vw - var(--side-offset) - var(--opposite-offset) - 64px));
  overflow-wrap: anywhere;
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
  transform: translateY(50%);
  transition:
    opacity 200ms ease,
    transform 200ms ease,
    visibility 200ms allow-discrete;
}

.launcher-bubble::before {
  content: '';
  position: absolute;
  left: var(--tip-origin);
  top: 50%;
  width: 8px;
  height: 8px;
  background: inherit;
  border: inherit;
  border-top: 0;
  border-right: 0;
  transform: translate(-50%, -50%) scaleX(var(--side-sign)) rotate(45deg);
  pointer-events: none;
}

.launcher-bubble[hidden] {
  display: none;
  opacity: 0;
  transform: translate(calc(var(--side-sign) * -6px), 50%);
  visibility: hidden;
}

@media (--chatbot-compact) {
  .launcher-bubble { display: none; }
}

/* Hide synchronously, including programmatic panel opens and tooltip-producing focus. */
.launcher-wrap:has(.launcher[aria-expanded="true"]) .launcher-bubble,
.launcher-wrap:has(.launcher:hover, .launcher:focus-visible, .quick-dock:hover, .quick-dock:focus-within) .launcher-bubble {
  display: none;
}

@starting-style {
  .launcher-bubble:not([hidden]) {
    opacity: 0;
    transform: translate(calc(var(--side-sign) * -6px), 50%);
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

  .launcher::after { transition: none; }

  @starting-style {
    .launcher-bubble:not([hidden]) {
      opacity: 1;
      transform: translateY(50%);
    }
  }
}
`;

const CHAT_ICON_PATH = 'M7.5 8.25h9m-9 3H12m-6.75 9.75 1.664.89 2.23.596.09.055.199-.055 1.664-.89H18a2.25 2.25 0 0 0 2.25-2.25V7.5A2.25 2.25 0 0 0 18 5.25H6A2.25 2.25 0 0 0 3.75 7.5v9.75A2.25 2.25 0 0 0 6 20.25Z';

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
  return resolveCompactStyles(`${launcherHostStyles(page)}${LAUNCHER_STYLE_BODY}${dockStyles}`);
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
  const compact = matchCompactMode();
  if (compact.matches || launcherBubbleSeen()) {
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
  compact.addEventListener?.('change', (event) => {
    if (event.matches) dismissBubble();
  });

  state.autoHideId = setTimeout(dismissBubble, LAUNCHER_BUBBLE_AUTO_HIDE_MS);
  return state;
}

export function mountLauncher(host: HTMLElement, page: 'main' | 'v4'): HTMLButtonElement {
  host.setAttribute('data-side', CHATBOT_CONFIG.launcherSide);
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
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'launcher__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', CHAT_ICON_PATH);
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  button.appendChild(svg);

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
  if (bubbleState !== undefined) {
    const dismissBubble = (): void => hideLauncherBubble(bubbleState);
    for (const control of [button, ...wrap.querySelectorAll('.quick-dock__button')]) {
      for (const event of ['pointerenter', 'mouseenter', 'focus', 'pointerdown', 'keydown', 'click']) {
        control.addEventListener(event, dismissBubble);
      }
    }
  }
  shadow.appendChild(wrap);
  return button;
}
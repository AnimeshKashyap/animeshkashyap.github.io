const LAUNCHER_STYLE_BODY = `
.launcher {
  position: fixed;
  left: max(16px, env(safe-area-inset-left, 0px));
  bottom: max(16px, env(safe-area-inset-bottom, 0px));
  z-index: 30;
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
    transform 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease;
  animation: launcher-idle 4s ease-in-out infinite;
}

.launcher:hover {
  transform: scale(1.06);
  box-shadow: var(--shadow-card, 0 20px 60px rgba(0, 0, 0, 0.35));
  filter: brightness(1.08);
}

.launcher:active {
  transform: scale(0.97);
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

@keyframes launcher-idle {
  0%,
  100% {
    box-shadow: var(--shadow-card, 0 20px 60px rgba(0, 0, 0, 0.35));
  }
  50% {
    box-shadow:
      0 24px 64px rgba(0, 0, 0, 0.4),
      0 0 24px color-mix(in srgb, var(--accent-violet, #a78bfa) 25%, transparent);
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
  --accent-cyan: #3b82f6;
  --accent-violet: #60a5fa;
  --accent-gradient: linear-gradient(120deg, var(--accent-cyan), var(--accent-violet));
  --shadow-card: 0 8px 24px rgba(0, 0, 0, 0.4);
}
`;
  }
  return `:host {
  all: initial;
}
`;
}

function buildLauncherStyles(page: 'main' | 'v4'): string {
  return `${launcherHostStyles(page)}${LAUNCHER_STYLE_BODY}`;
}

function launcherAriaLabel(page: 'main' | 'v4'): string {
  if (page === 'v4') {
    return 'Open portfolio assistant on character view';
  }
  return 'Open portfolio assistant';
}

export function mountLauncher(host: HTMLElement, page: 'main' | 'v4'): HTMLButtonElement {
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = buildLauncherStyles(page);
  shadow.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'launcher';
  button.setAttribute('aria-label', launcherAriaLabel(page));
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'portfolio-chat-panel');
  button.innerHTML = CHAT_ICON_SVG;

  button.addEventListener('click', () => {
    void import('./panel/panel').then(({ openPanel }) => {
      openPanel();
    });
  });

  shadow.appendChild(button);
  return button;
}

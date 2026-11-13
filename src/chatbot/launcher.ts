const LAUNCHER_STYLES = `
:host {
  all: initial;
}

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
  background: linear-gradient(145deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%);
  box-shadow:
    0 4px 14px rgba(37, 99, 235, 0.45),
    0 2px 4px rgba(15, 23, 42, 0.12);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease;
  animation: launcher-idle 4s ease-in-out infinite;
}

.launcher:hover {
  transform: scale(1.06);
  box-shadow:
    0 6px 20px rgba(37, 99, 235, 0.55),
    0 3px 8px rgba(15, 23, 42, 0.15);
  filter: brightness(1.05);
}

.launcher:active {
  transform: scale(0.97);
}

.launcher:focus-visible {
  outline: 2px solid #93c5fd;
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
    box-shadow:
      0 4px 14px rgba(37, 99, 235, 0.45),
      0 2px 4px rgba(15, 23, 42, 0.12);
  }
  50% {
    box-shadow:
      0 5px 18px rgba(37, 99, 235, 0.55),
      0 3px 6px rgba(15, 23, 42, 0.14);
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

function launcherAriaLabel(page: 'main' | 'v4'): string {
  if (page === 'v4') {
    return 'Open portfolio assistant on character view';
  }
  return 'Open portfolio assistant';
}

export function mountLauncher(host: HTMLElement, page: 'main' | 'v4'): HTMLButtonElement {
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = LAUNCHER_STYLES;
  shadow.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'launcher';
  button.setAttribute('aria-label', launcherAriaLabel(page));
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = CHAT_ICON_SVG;

  button.addEventListener('click', () => {
    void import('./panel/panel').then(({ openPanel }) => {
      openPanel();
    });
  });

  shadow.appendChild(button);
  return button;
}

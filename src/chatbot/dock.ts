import type { ActionId } from './types';

const actions: { id: ActionId; label: string; path: string }[] = [
  { id: 'cv', label: 'Download resume', path: 'M6 3h8l4 4v14H6z M14 3v5h4 M12 11v6m-3-3 3 3 3-3' },
  { id: 'email', label: 'Email Animesh', path: 'M3 5h18v14H3z M3 6l9 7 9-7' },
  { id: 'linkedin', label: 'LinkedIn', path: 'M5 9v10 M5 5v.1 M10 19V9m0 4c0-5 8-5 8 0v6' },
  { id: 'github', label: 'GitHub', path: 'M9 19c-5 1-5-2-7-2m14 4v-3c0-1-.4-1.7-1-2 3-.3 5-1.5 5-5a4 4 0 0 0-1-3c.2-1 .1-2-.3-3-1 0-2 .5-3 1a11 11 0 0 0-6 0C9 5.5 8 5 7 5c-.4 1-.5 2-.3 3a4 4 0 0 0-1 3c0 3.5 2 4.7 5 5-.6.3-1 1-1 2v3' },
  { id: 'projects', label: 'View projects', path: 'M3 6h7l2 2h9v11H3z M3 8h18' },
];

export const dockStyles = `
.quick-dock {
  position: fixed; z-index: 31;
  left: calc(max(16px, env(safe-area-inset-left, 0px)) + 16px);
  bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + 66px);
  width: 40px; height: 40px;
  transform: translate(var(--dock-x, 0px), var(--dock-y, 0px));
  transition: transform 240ms ease;
}
.quick-dock__button { position: absolute; left: 0; bottom: 0; transform: translateY(calc(var(--index) * -46px)); transition: transform 240ms ease; }
.quick-dock__button:nth-child(1) { --index: 0; }
.quick-dock__button:nth-child(2) { --index: 1; }
.quick-dock__button:nth-child(3) { --index: 2; }
.quick-dock__button:nth-child(4) { --index: 3; }
.quick-dock__button:nth-child(5) { --index: 4; }
.launcher[aria-expanded="true"] ~ .quick-dock {
  --dock-x: calc(100vw - env(safe-area-inset-right, 0px) - 224px - max(16px, env(safe-area-inset-left, 0px)) - 16px);
  --dock-y: calc(max(16px, env(safe-area-inset-bottom, 0px)) + 66px - 100dvh + max(16px, env(safe-area-inset-top, 0px)) + 40px);
}
.launcher[aria-expanded="true"] ~ .quick-dock .quick-dock__button { transform: translateX(calc(var(--index) * 46px)); }
@media (min-width: 480px) {
  .launcher[aria-expanded="true"] ~ .quick-dock {
    --dock-x: calc(min(380px, 100vw - 32px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) - 240px);
    --dock-y: calc(-12px - min(560px, 100dvh - max(16px, env(safe-area-inset-bottom, 0px)) - 56px - 12px - max(16px, env(safe-area-inset-top, 0px)) - 60px));
  }
}
/* Keep the open row and its edge tooltips within narrow viewports. */
@media (max-width: 479px) {
  .launcher[aria-expanded="true"] ~ .quick-dock { --dock-x: calc(max(0px, 100vw - env(safe-area-inset-right, 0px) - 224px) - max(16px, env(safe-area-inset-left, 0px)) - 16px); }
  .launcher[aria-expanded="true"] ~ .quick-dock .quick-dock__button:first-child::after { left: 0; transform: none; }
  .launcher[aria-expanded="true"] ~ .quick-dock .quick-dock__button:last-child::after { left: auto; right: 0; transform: none; }
}
@media (max-width: 223px) {
  .launcher[aria-expanded="true"] ~ .quick-dock .quick-dock__button { transform: translateX(calc(var(--index) * (100vw - 40px) / 4)); }
}
@media (prefers-reduced-motion: reduce) {
  .quick-dock, .quick-dock__button { transition: none; }
}
.quick-dock__button {
  display: grid; place-items: center; box-sizing: border-box;
  width: 40px; height: 40px; padding: 0; border-radius: 50%; cursor: pointer;
  border: 1px solid var(--border, rgba(255,255,255,.12));
  color: var(--text-primary, #eef1f8); background: var(--bg-raised, #0b0f1a);
  box-shadow: var(--shadow-card, 0 8px 24px rgba(0,0,0,.35));
}
.quick-dock__button:hover { color: var(--accent-cyan, #5eead4); }
.quick-dock__button:focus-visible { outline: 2px solid var(--accent-cyan, #5eead4); outline-offset: 3px; }
.quick-dock__button svg { width: 20px; height: 20px; }
.quick-dock__button::after {
  /* The left safe area leaves at most 24px for a label: use the right side instead. */
  content: attr(data-tooltip); position: absolute; left: calc(100% + 8px); right: auto; top: 50%;
  transform: translateY(-50%); pointer-events: none; opacity: 0;
  box-sizing: border-box; width: max-content;
  max-width: max(0px, calc(100vw - max(16px, env(safe-area-inset-left, 0px)) - 64px - env(safe-area-inset-right, 0px)));
  overflow-wrap: anywhere;
  padding: 5px 8px; border-radius: 6px; font: 12px var(--font-body, system-ui, sans-serif);
  color: var(--text-primary, #eef1f8); background: var(--bg-raised, #0b0f1a);
  border: 1px solid var(--border, rgba(255,255,255,.12));
}
.launcher[aria-expanded="true"] ~ .quick-dock .quick-dock__button::after {
  left: 50%; right: auto; top: auto; bottom: calc(100% + 8px); transform: translateX(-50%);
  max-width: calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
}
/* On short desktop viewports, put tooltips below instead of beyond the top edge. */
@media (min-width: 480px) and (max-height: 750px) {
  .launcher[aria-expanded="true"] ~ .quick-dock .quick-dock__button::after { top: calc(100% + 8px); bottom: auto; }
}
.quick-dock__button:hover::after, .quick-dock__button:focus-visible::after { opacity: 1; }
`;

export function createDock(page: 'main' | 'v4'): HTMLElement {
  const dock = document.createElement('div');
  dock.className = 'quick-dock';
  dock.setAttribute('role', 'group');
  dock.setAttribute('aria-label', 'Quick actions');

  for (const { id, label, path } of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quick-dock__button';
    button.setAttribute('aria-label', label);
    button.setAttribute('data-tooltip', label);
    button.setAttribute('data-action', id);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    icon.setAttribute('d', path);
    svg.appendChild(icon);
    button.appendChild(svg);
    button.addEventListener('click', () => {
      void import('./engine/actions').then(({ runAction }) => runAction(id, { page }));
    });
    dock.appendChild(button);
  }
  return dock;
}

import { matchCompactMode, resolveCompactStyles } from './compact';
import type { ActionId } from './types';

const actions: { id: ActionId; label: string; path: string }[] = [
  { id: 'cv', label: 'Download resume', path: 'M6 3h8l4 4v14H6z M14 3v5h4 M12 11v6m-3-3 3 3 3-3' },
  { id: 'email', label: 'Email Animesh', path: 'M3 5h18v14H3z M3 6l9 7 9-7' },
  { id: 'linkedin', label: 'LinkedIn', path: 'M5 9v10 M5 5v.1 M10 19V9m0 4c0-5 8-5 8 0v6' },
  { id: 'github', label: 'GitHub', path: 'M9 19c-5 1-5-2-7-2m14 4v-3c0-1-.4-1.7-1-2 3-.3 5-1.5 5-5a4 4 0 0 0-1-3c.2-1 .1-2-.3-3-1 0-2 .5-3 1a11 11 0 0 0-6 0C9 5.5 8 5 7 5c-.4 1-.5 2-.3 3a4 4 0 0 0-1 3c0 3.5 2 4.7 5 5-.6.3-1 1-1 2v3' },
  { id: 'projects', label: 'View projects', path: 'M3 6h7l2 2h9v11H3z M3 8h18' },
];

export const dockStyles = resolveCompactStyles(`
.quick-dock {
  position: fixed; z-index: 31;
  left: var(--side-left); right: var(--side-right);
  bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + 66px);
  width: 40px; height: 40px;
  transform: translate(calc(var(--side-sign) * var(--dock-x, 8px)), var(--dock-y, 0px));
  transition: transform 240ms ease, opacity 240ms ease;
}
.quick-dock__button { position: absolute; left: 0; bottom: 0; transform: translateY(calc(var(--index) * -46px)); transition: transform 240ms ease; }
.quick-dock__button:nth-child(1) { --index: 0; }
.quick-dock__button:nth-child(2) { --index: 1; }
.quick-dock__button:nth-child(3) { --index: 2; }
.quick-dock__button:nth-child(4) { --index: 3; }
.quick-dock__button:nth-child(5) { --index: 4; }
.launcher[aria-expanded="true"] ~ .quick-dock {
  --dock-x: 0px;
  --dock-y: calc(max(16px, env(safe-area-inset-bottom, 0px)) + 66px - 100dvh + max(16px, env(safe-area-inset-top, 0px)) + 40px);
}
.launcher[aria-expanded="true"] ~ .quick-dock .quick-dock__button { transform: translateX(calc(var(--side-sign) * var(--index) * 46px)); }
@media (--chatbot-desktop) {
  .launcher[aria-expanded="true"] ~ .quick-dock {
    --dock-x: 0px;
    --dock-y: calc(-12px - min(560px, 100dvh - max(16px, env(safe-area-inset-bottom, 0px)) - 56px - 12px - max(16px, env(safe-area-inset-top, 0px)) - 60px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .quick-dock, .quick-dock__button { transition: none; }
}
.quick-dock__button {
  display: grid; place-items: center; box-sizing: border-box;
  width: 40px; height: 40px; padding: 0; border-radius: 50%; cursor: pointer;
  border: none;
  color: var(--text-primary, #eef1f8); background: var(--bg-raised, #0b0f1a);
  box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.12)), var(--shadow-card, 0 8px 24px rgba(0,0,0,.35));
}
.quick-dock__button:hover { color: var(--accent-cyan, #5eead4); }
.quick-dock__button:focus-visible { outline: 2px solid var(--accent-cyan, #5eead4); outline-offset: 3px; }
.quick-dock__button svg { width: 20px; height: 20px; }
.quick-dock__button::after {
  content: attr(data-tooltip); position: absolute; left: var(--tip-left); right: var(--tip-right); top: 50%;
  transform: translateY(-50%); pointer-events: none; opacity: 0;
  box-sizing: border-box; width: max-content;
  max-width: max(0px, calc(100vw - var(--side-offset) - var(--opposite-offset) - 56px));
  transition: opacity 180ms ease;
  overflow-wrap: anywhere;
  padding: 5px 8px; border-radius: 6px; font: 12px var(--font-body, system-ui, sans-serif);
  color: var(--text-primary, #eef1f8); background: var(--bg-raised, #0b0f1a);
  border: 1px solid var(--border, rgba(255,255,255,.12));
}
.launcher[aria-expanded="true"] ~ .quick-dock .quick-dock__button::after {
  left: calc(var(--tip-origin) - var(--side-sign) * var(--index) * 46px); right: auto; top: auto; bottom: calc(100% + 8px); transform: translateX(calc(-1 * var(--tip-origin)));
  max-width: calc(100vw - var(--side-offset) - var(--opposite-offset));
}
@media (prefers-reduced-motion: reduce) {
  .quick-dock__button::after { transition: none; }
}
.quick-dock__button:hover::after, .quick-dock__button:focus-visible::after { opacity: 1; }
.quick-dock__more { display: none; }
@media (--chatbot-compact) {
  .quick-dock__more {
    display: grid; place-items: center; box-sizing: border-box; flex-shrink: 0;
    width: 40px; height: 40px; padding: 0; border: none; border-radius: 50%; cursor: pointer;
    color: var(--text-primary, #eef1f8); background: var(--bg-raised, #0b0f1a);
    box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.12)), var(--shadow-card, 0 8px 24px rgba(0,0,0,.35));
  }
  .quick-dock__more:focus-visible { outline: 2px solid var(--accent-cyan, #5eead4); outline-offset: 3px; }
  .quick-dock__more svg { width: 20px; height: 20px; transition: transform 240ms ease; }
  .quick-dock__more[aria-expanded="true"] svg { transform: rotate(180deg); }
  .quick-dock { bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + 116px); --dock-x: 0px; }
  .quick-dock:not([data-open]) { visibility: hidden; pointer-events: none; transition: visibility 0s 240ms; }
  .quick-dock:not([data-open]) .quick-dock__button { transform: none; opacity: 0; }
  .quick-dock[data-open] .quick-dock__button { transform: translateY(calc(var(--index) * -46px)); opacity: 1; transition-delay: calc(var(--index) * 30ms); }
  .quick-dock__button { transition: transform 240ms ease, opacity 240ms ease; }
  .quick-dock__button::after { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .quick-dock__more svg, .quick-dock__button { transition: none !important; }
}
`);

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

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Compact-only "More options" toggle; returns a collapse function. */
export function mountMoreToggle(wrap: HTMLElement, dock: HTMLElement): () => void {
  const compact = matchCompactMode();
  dock.id = 'portfolio-chat-dock';
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'quick-dock__more';
  more.setAttribute('aria-label', 'More options');
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-controls', dock.id);
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'm6 15 6-6 6 6');
  svg.appendChild(path);
  more.appendChild(svg);

  const onPointerDown = (e: Event): void => {
    const t = e.composedPath();
    if (!t.includes(dock) && !t.includes(more)) setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') setOpen(false);
  };
  const sync = (open: boolean): void => {
    const hidden = compact.matches && !open;
    if (hidden) dock.setAttribute('inert', '');
    else dock.removeAttribute('inert');
    if (hidden) dock.setAttribute('aria-hidden', 'true');
    else dock.removeAttribute('aria-hidden');
    for (const b of dock.querySelectorAll('button')) {
      if (hidden) b.setAttribute('tabindex', '-1');
      else b.removeAttribute('tabindex');
    }
  };
  function setOpen(open: boolean): void {
    if (open === dock.hasAttribute('data-open')) return;
    if (open) dock.setAttribute('data-open', '');
    else dock.removeAttribute('data-open');
    more.setAttribute('aria-expanded', String(open));
    sync(open);
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('keydown', onKeyDown);
    if (open) {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
    }
  }
  more.addEventListener('click', () => setOpen(!dock.hasAttribute('data-open')));
  for (const b of dock.querySelectorAll('button')) b.addEventListener('click', () => setOpen(false));
  compact.addEventListener?.('change', () => {
    if (!compact.matches) setOpen(false);
    sync(dock.hasAttribute('data-open'));
  });
  sync(false);
  wrap.appendChild(more);
  return () => setOpen(false);
}

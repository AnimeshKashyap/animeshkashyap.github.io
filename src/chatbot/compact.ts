// Keep CSS and matchMedia on the same compact decision, including short windows.
export const COMPACT_QUERY = '(max-width: 479px), (max-height: 499px)';
const DESKTOP_QUERY = '(min-width: 480px) and (min-height: 500px)';

export function matchCompactMode(): MediaQueryList {
  return window.matchMedia(COMPACT_QUERY);
}

// Resolve scoped media aliases before attaching styles to the shadow root.
export function resolveCompactStyles(css: string): string {
  return css
    .replaceAll('(--chatbot-compact)', COMPACT_QUERY)
    .replaceAll('(--chatbot-desktop)', DESKTOP_QUERY);
}

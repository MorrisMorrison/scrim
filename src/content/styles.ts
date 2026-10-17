export const STYLE_IDS = {
  actions: 'scrim-actions',
  prehide: 'scrim-prehide',
  tweaks: 'scrim-tweaks',
  overlay: 'scrim-overlay-style',
} as const;

// Reveal mode (popup toggle) disables every hiding rule and outlines hits instead.
export const ACTION_CSS = `
html:not(.scrim-reveal) .scrim-hidden { display: none !important; }
html:not(.scrim-reveal) .scrim-blurred { filter: blur(10px) !important; cursor: pointer !important; }
html.scrim-reveal [data-scrim^="hit"] { outline: 2px dashed #d33333 !important; outline-offset: -2px; }
html.scrim-reveal [data-scrim-bar] { display: none !important; }
.scrim-bar {
  display: flex; align-items: center; gap: 6px; margin: 4px 0; padding: 6px 10px;
  font: 12px/1.4 system-ui, sans-serif; color: #888;
  border: 1px dashed rgba(136, 136, 136, 0.4); border-radius: 6px;
}
.scrim-bar button {
  all: unset; cursor: pointer; text-decoration: underline; color: inherit;
}
`;

export function prehideCss(itemSelector: string): string {
  return `html:not(.scrim-reveal) :is(${itemSelector}):not([data-scrim]) { visibility: hidden !important; }`;
}

export function setStyle(doc: Document, id: string, css: string | null): void {
  let el = doc.getElementById(id);
  if (css === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = doc.createElement('style');
    el.id = id;
    (doc.head ?? doc.documentElement).appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

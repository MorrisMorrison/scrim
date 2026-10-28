// A small confirmation toast for in-page feedback ("Hiding r/x under Work · Undo"). Lives in its
// own shadow root so the page's CSS can't restyle or hide it; one at a time.
export const TOAST_ID = 'scrim-toast';
export const TOAST_MS = 6000;

const CSS = `
:host { all: initial; }
.toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483647;
  display: flex; align-items: center; gap: 12px; max-width: min(90vw, 480px);
  padding: 10px 14px; border-radius: 8px; background: #1b1b1f; color: #ececf1;
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.35);
}
button {
  all: unset; cursor: pointer; color: #ff8a80; font-weight: 600; text-decoration: underline;
}
`;

let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(doc: Document, message: string, onUndo?: () => void): void {
  hideToast(doc);
  const host = doc.createElement('div');
  host.id = TOAST_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = CSS;
  const box = doc.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'status');
  const text = doc.createElement('span');
  text.textContent = message;
  box.append(text);
  if (onUndo) {
    const undo = doc.createElement('button');
    undo.type = 'button';
    undo.textContent = 'Undo';
    undo.addEventListener('click', () => {
      hideToast(doc);
      onUndo();
    });
    box.append(undo);
  }
  root.append(style, box);
  doc.documentElement.appendChild(host);
  timer = setTimeout(() => hideToast(doc), TOAST_MS);
}

export function hideToast(doc: Document): void {
  clearTimeout(timer);
  timer = undefined;
  doc.getElementById(TOAST_ID)?.remove();
}

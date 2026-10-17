import { setStyle, STYLE_IDS } from './styles';

export const OVERLAY_ID = 'scrim-block';

export interface OverlayContent {
  message: string;
  detail: string;
  onPeek(): void;
}

const OVERLAY_CSS = `
#scrim-block {
  position: fixed !important; inset: 0 !important; z-index: 2147483647 !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
  padding: 24px !important; margin: 0 !important;
  background: radial-gradient(circle at 50% 30%, #1b1b20, #0a0a0c) !important;
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif !important; color: #eee !important;
}
#scrim-block .scrim-card { max-width: 480px !important; text-align: center !important; }
#scrim-block .scrim-emoji { font-size: 64px !important; line-height: 1 !important; margin-bottom: 20px !important; }
#scrim-block .scrim-msg { font-size: 24px !important; font-weight: 600 !important; color: #fff !important; margin-bottom: 12px !important; }
#scrim-block .scrim-sub {
  font-size: 13px !important; color: #ff6600 !important; text-transform: uppercase !important;
  letter-spacing: 0.08em !important; margin-bottom: 28px !important;
}
#scrim-block button {
  all: unset; cursor: pointer; font-size: 13px; color: #888;
  border-bottom: 1px dotted #666; padding-bottom: 1px;
}
#scrim-block button:hover { color: #bbb; }
`;

export function showPageBlock(doc: Document, content: OverlayContent): void {
  if (doc.getElementById(OVERLAY_ID)) return;
  setStyle(doc, STYLE_IDS.overlay, OVERLAY_CSS);

  const overlay = doc.createElement('div');
  overlay.id = OVERLAY_ID;
  const card = doc.createElement('div');
  card.className = 'scrim-card';

  const emoji = doc.createElement('div');
  emoji.className = 'scrim-emoji';
  emoji.textContent = '🚫';
  const msg = doc.createElement('div');
  msg.className = 'scrim-msg';
  msg.textContent = content.message;
  const sub = doc.createElement('div');
  sub.className = 'scrim-sub';
  sub.textContent = content.detail;
  const peek = doc.createElement('button');
  peek.type = 'button';
  peek.textContent = 'Peek for 5 min';
  peek.addEventListener('click', (e) => {
    e.preventDefault();
    content.onPeek();
  });

  card.append(emoji, msg, sub, peek);
  overlay.append(card);
  (doc.body ?? doc.documentElement).appendChild(overlay);
}

export function hidePageBlock(doc: Document): void {
  doc.getElementById(OVERLAY_ID)?.remove();
}

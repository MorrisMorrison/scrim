import type { Action, Verdict } from '../core/model';

export const SCRIM_ATTR = 'data-scrim';
export const BAR_ATTR = 'data-scrim-bar';
const ACTION_CLASSES = ['scrim-hidden', 'scrim-blurred'];

const revealMode = (doc: Document) => doc.documentElement.classList.contains('scrim-reveal');

export function applyAction(
  el: Element,
  related: Element[],
  action: Action,
  verdict: Verdict,
  topicName: string,
): void {
  const all = [el, ...related];
  for (const e of all) e.setAttribute(SCRIM_ATTR, `hit:${verdict.topicId}`);

  if (action === 'blur') {
    for (const e of all) e.classList.add('scrim-blurred');
    el.addEventListener(
      'click',
      (ev) => {
        if (!el.classList.contains('scrim-blurred') || revealMode(el.ownerDocument)) return;
        ev.preventDefault();
        ev.stopPropagation();
        for (const e of all) e.classList.remove('scrim-blurred');
      },
      { capture: true },
    );
    return;
  }

  for (const e of all) e.classList.add('scrim-hidden');
  if (action === 'collapse') insertBar(el, all, topicName);
}

// Slim "Scrim · AI · show" bar before the item. Table rows (Hacker News) need a <tr>.
function insertBar(el: Element, all: Element[], topicName: string): void {
  const doc = el.ownerDocument;
  const isRow = el.tagName === 'TR';
  const bar = doc.createElement(isRow ? 'tr' : 'div');
  bar.setAttribute(BAR_ATTR, '');
  let body: HTMLElement = bar;
  if (isRow) {
    const cell = doc.createElement('td');
    cell.colSpan = 99;
    bar.appendChild(cell);
    body = cell;
  }
  body.className = 'scrim-bar';
  const label = doc.createElement('span');
  label.textContent = `Scrim · ${topicName} ·`;
  const show = doc.createElement('button');
  show.type = 'button';
  show.textContent = 'show';
  show.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    for (const e of all) e.classList.remove('scrim-hidden');
    bar.remove();
  });
  body.append(label, show);
  el.before(bar);
}

export function clearActions(doc: Document): void {
  doc.querySelectorAll(`[${BAR_ATTR}]`).forEach((b) => b.remove());
  doc.querySelectorAll(`[${SCRIM_ATTR}]`).forEach((e) => {
    e.removeAttribute(SCRIM_ATTR);
    e.classList.remove(...ACTION_CLASSES);
  });
}

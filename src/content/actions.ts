import type { Action, Verdict } from '../core/model';

export const SCRIM_ATTR = 'data-scrim';
export const BAR_ATTR = 'data-scrim-bar';
const ACTION_CLASSES = ['scrim-hidden', 'scrim-blurred'];

const revealMode = (doc: Document) => doc.documentElement.classList.contains('scrim-reveal');

// Returns the collapse bar it inserted, if any.
export function applyAction(
  el: Element,
  related: Element[],
  action: Action,
  verdict: Verdict,
  topicName: string,
): Element | null {
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
    return null;
  }

  for (const e of all) e.classList.add('scrim-hidden');
  return action === 'collapse' ? insertBar(el, all, topicName) : null;
}

// Slim "Scrim · AI · show" bar before the item. Table rows (Hacker News) need a <tr>.
function insertBar(el: Element, all: Element[], topicName: string): Element {
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
  return bar;
}

// Last-resort recovery when applying an action threw midway: show the item as normal.
export function failOpen(el: Element): void {
  try {
    el.classList.remove(...ACTION_CLASSES);
    el.setAttribute(SCRIM_ATTR, 'pass');
  } catch {
    // Nothing more can be done for this element.
  }
}

// Undoes applyAction (or a pass) for one item, so it can be evaluated afresh.
export function clearItem(el: Element, related: Element[], bar: Element | null): void {
  bar?.remove();
  for (const e of [el, ...related]) {
    e.removeAttribute(SCRIM_ATTR);
    e.classList.remove(...ACTION_CLASSES);
  }
}

export function clearActions(doc: Document): void {
  doc.querySelectorAll(`[${BAR_ATTR}]`).forEach((b) => b.remove());
  doc.querySelectorAll(`[${SCRIM_ATTR}]`).forEach((e) => {
    e.removeAttribute(SCRIM_ATTR);
    e.classList.remove(...ACTION_CLASSES);
  });
}

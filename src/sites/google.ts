import { normalizeHost } from '../core/host';
import { linkDomains, richText } from './dom';
import type { SiteAdapter, Tweak } from './types';

export const googleSearch: SiteAdapter = {
  id: 'google-search',
  label: 'Google Search',
  hosts: ['google.com'],
  appliesTo: (host) => normalizeHost(host) === 'google.com',
  itemSelector: 'div.g, div[data-hveid] > div.tF2Cxc',
  extract: (el) => ({ text: richText(el), sources: linkDomains(el) }),
  // Web results only: the images/videos/shopping tabs (tbm=…, udm=…) use other layouts.
  expectsItems: (url) =>
    url.pathname === '/search' && !url.searchParams.has('tbm') && !url.searchParams.has('udm'),
};

export const googleNews: SiteAdapter = {
  id: 'google-news',
  label: 'Google News',
  hosts: ['news.google.com'],
  itemSelector: 'article',
  extract: (el) => ({ text: richText(el), sources: linkDomains(el) }),
  expectsItems: (url) => /^\/($|home|foryou|topics|stories|search)/.test(url.pathname),
};

const KNOWN_AIO = 'div[data-subtree="aio"], div[data-al-attr="aio"], #m-x-content';
const AIO_LABEL = /^(ai overview|ki-übersicht|ki-zusammenfassung|übersicht mit ki|mit ki erstellt)/i;
// Never climb into (or past) the page's main columns.
const CLIMB_STOP = 'body, #center_col, #rso, #rcnt, [role="main"]';

const HEADINGS = 'h1, h2, [role="heading"], div[aria-level]';
const AIO_MARK = 'data-scrim-aio';
// The overview streams in within a few seconds of the results; after this the tweak stops
// watching the page (the CSS keeps hiding the known containers regardless).
export const AIO_WATCH_MS = 15_000;

// The block to hide for a heading labelled "AI Overview": climb to a container of real height,
// but never into (or past) the main columns. Layout is read once per labelled heading.
function overviewBlock(h: Element): Element {
  let c: Element = h;
  for (let i = 0; i < 6; i++) {
    const parent: Element | null = c.parentElement;
    if (!parent || parent.matches(CLIMB_STOP)) break;
    c = parent;
    if ((c as HTMLElement).offsetHeight > 120) break;
  }
  return c;
}

function collect(root: Document | Element, found: Set<Element>): void {
  const self = root instanceof Element ? [root] : [];
  for (const el of [...self, ...Array.from(root.querySelectorAll(KNOWN_AIO))]) {
    if (el.matches(KNOWN_AIO)) found.add(el);
  }
  for (const h of [...self, ...Array.from(root.querySelectorAll(HEADINGS))]) {
    if (!h.matches(HEADINGS) || h.closest(`[${AIO_MARK}]`)) continue; // already hidden
    if (AIO_LABEL.test((h.textContent ?? '').trim())) found.add(overviewBlock(h));
  }
}

// Google's injected AI answer block. Selectors rot fast, so known containers are
// combined with a heading-text heuristic (EN + DE).
export function findAiOverviewBlocks(root: Document | Element): Element[] {
  const found = new Set<Element>();
  collect(root, found);
  return [...found];
}

function hide(blocks: Iterable<Element>): void {
  for (const el of blocks) {
    if (el.hasAttribute(AIO_MARK)) continue;
    el.setAttribute(AIO_MARK, '');
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
  }
}

export const hideAiOverview: Tweak = {
  id: 'google.hideAiOverview',
  site: 'google-search',
  label: 'Hide AI Overview',
  css: `${KNOWN_AIO} { display: none !important; }`,
  run(doc) {
    // Only the subtrees that changed are searched: elements added, and the parents of added
    // text (a heading whose text is filled in later). Never the whole document per frame.
    const changed = new Set<Element>();
    let queued = false;
    let disposed = false;
    const flush = () => {
      queued = false;
      if (disposed) return; // a frame queued before cleanup must not hide anything
      const found = new Set<Element>();
      for (const root of changed) if (root.isConnected) collect(root, found);
      changed.clear();
      hide(found);
    };
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          const root = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
          if (root && !root.closest(`[${AIO_MARK}]`)) changed.add(root);
        });
      }
      if (changed.size === 0 || queued) return;
      queued = true;
      requestAnimationFrame(flush);
    });
    hide(findAiOverviewBlocks(doc));
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    const stopWatching = setTimeout(() => {
      observer.disconnect();
      changed.clear();
    }, AIO_WATCH_MS);
    return () => {
      disposed = true;
      clearTimeout(stopWatching);
      observer.disconnect();
      doc.querySelectorAll(`[${AIO_MARK}]`).forEach((el) => {
        el.removeAttribute(AIO_MARK);
        (el as HTMLElement).style.removeProperty('display');
      });
    };
  },
};

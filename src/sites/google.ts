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
};

export const googleNews: SiteAdapter = {
  id: 'google-news',
  label: 'Google News',
  hosts: ['news.google.com'],
  itemSelector: 'article',
  extract: (el) => ({ text: richText(el), sources: linkDomains(el) }),
};

const KNOWN_AIO = 'div[data-subtree="aio"], div[data-al-attr="aio"], #m-x-content';
const AIO_LABEL = /^(ai overview|ki-übersicht|ki-zusammenfassung|übersicht mit ki|mit ki erstellt)/i;
// Never climb into (or past) the page's main columns.
const CLIMB_STOP = 'body, #center_col, #rso, #rcnt, [role="main"]';

// Google's injected AI answer block. Selectors rot fast, so known containers are
// combined with a heading-text heuristic (EN + DE).
export function findAiOverviewBlocks(root: Document | Element): Element[] {
  const found = new Set<Element>(root.querySelectorAll(KNOWN_AIO));
  root.querySelectorAll('h1, h2, [role="heading"], div[aria-level]').forEach((h) => {
    if (!AIO_LABEL.test((h.textContent ?? '').trim())) return;
    let c: Element = h;
    for (let i = 0; i < 6; i++) {
      const parent: Element | null = c.parentElement;
      if (!parent || parent.matches(CLIMB_STOP)) break;
      c = parent;
      if ((c as HTMLElement).offsetHeight > 120) break;
    }
    found.add(c);
  });
  return [...found];
}

const AIO_MARK = 'data-scrim-aio';

export const hideAiOverview: Tweak = {
  id: 'google.hideAiOverview',
  site: 'google-search',
  label: 'Hide AI Overview',
  css: `${KNOWN_AIO} { display: none !important; }`,
  run(doc) {
    const hideAll = () => {
      for (const el of findAiOverviewBlocks(doc)) {
        if (el.hasAttribute(AIO_MARK)) continue;
        el.setAttribute(AIO_MARK, '');
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
      }
    };
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        hideAll();
      });
    });
    hideAll();
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      doc.querySelectorAll(`[${AIO_MARK}]`).forEach((el) => {
        el.removeAttribute(AIO_MARK);
        (el as HTMLElement).style.removeProperty('display');
      });
    };
  },
};

import type { SourceRef } from '../core/model';
import { dedupeSources, linkDomains, richText } from './dom';
import type { SiteAdapter } from './types';

// The row after a story, if it is the story's subtext rather than another item (or comment) row.
function subtextRow(el: Element): Element | null {
  const sub = el.nextElementSibling;
  return sub && !sub.classList.contains('athing') ? sub : null;
}

// A story is three <tr>s: title (tr.athing.submission), subtext, spacer. Comments are
// tr.athing.comtr on item pages and are never items.
export const hackerNews: SiteAdapter = {
  id: 'hackernews',
  label: 'Hacker News',
  hosts: ['news.ycombinator.com'],
  itemSelector: 'tr.athing.submission',
  extract(el) {
    const sub = subtextRow(el);
    const sources: SourceRef[] = [...linkDomains(el)];
    el.querySelectorAll('span.sitestr').forEach((n) => {
      const host = (n.textContent ?? '').trim().split('/')[0];
      if (host) sources.push({ kind: 'domain', host });
    });
    const text = [richText(el), sub ? richText(sub) : ''].join(' ').trim();
    return { text, sources: dedupeSources(sources) };
  },
  related(el) {
    const out: Element[] = [];
    const sub = subtextRow(el);
    if (sub) {
      out.push(sub);
      const spacer = sub.nextElementSibling;
      if (spacer?.classList.contains('spacer')) out.push(spacer);
    }
    return out;
  },
  // Story lists; an item page (/item?id=…) has comments, not stories.
  expectsItems: (url) => /^\/($|(news|newest|front|best|ask|show)\b)/.test(url.pathname),
};

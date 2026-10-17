import type { SourceRef } from '../core/model';
import { dedupeSources, linkDomains, richText } from './dom';
import type { SiteAdapter } from './types';

// A story is three <tr>s: title (tr.athing), subtext, spacer.
export const hackerNews: SiteAdapter = {
  id: 'hackernews',
  label: 'Hacker News',
  hosts: ['news.ycombinator.com'],
  itemSelector: 'tr.athing',
  extract(el) {
    const sub = el.nextElementSibling;
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
    const sub = el.nextElementSibling;
    if (sub) {
      out.push(sub);
      const spacer = sub.nextElementSibling;
      if (spacer?.classList.contains('spacer')) out.push(spacer);
    }
    return out;
  },
};

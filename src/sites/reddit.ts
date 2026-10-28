import type { SourceRef } from '../core/model';
import { dedupeSources, linkDomains, richText } from './dom';
import type { SiteAdapter } from './types';

// Current Reddit wraps every card (organic AND ad) in <article>; shreddit-post is a
// fallback for older shreddit; the rest cover the React redesign and old.reddit.
export const reddit: SiteAdapter = {
  id: 'reddit',
  label: 'Reddit',
  hosts: ['reddit.com'],
  itemSelector:
    'article, shreddit-post, shreddit-ad-post, [data-testid="post-container"], .thing.link, .thing.promoted',
  extract(el) {
    const sources: SourceRef[] = [...linkDomains(el)];
    const post = el.matches('shreddit-post, shreddit-ad-post')
      ? el
      : el.querySelector('shreddit-post, shreddit-ad-post');
    const prefixed = post?.getAttribute('subreddit-prefixed-name') ?? '';
    if (prefixed.startsWith('r/')) sources.push({ kind: 'subreddit', name: prefixed.slice(2) });
    el.querySelectorAll('a[href*="/r/"]').forEach((a) => {
      const m = /\/r\/([A-Za-z0-9_]+)/.exec(a.getAttribute('href') ?? '');
      if (m) sources.push({ kind: 'subreddit', name: m[1] ?? '' });
    });
    return { text: richText(el), sources: dedupeSources(sources) };
  },
  pageSource(url) {
    const m = /^\/r\/([A-Za-z0-9_]+)/.exec(url.pathname);
    return m ? { kind: 'subreddit', name: m[1] ?? '' } : null;
  },
  // Home, the sort tabs and any subreddit (listings and post pages).
  expectsItems: (url) => /^\/($|(best|hot|new|top|rising)\b|r\/)/.test(url.pathname),
};

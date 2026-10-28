import type { SourceRef } from '../core/model';
import { dedupeSources, linkDomains, richText } from './dom';
import type { SiteAdapter } from './types';

// Top-level routes that look like /handle but aren't users.
const RESERVED = new Set([
  'home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose',
  'login', 'logout', 'signup', 'tos', 'privacy', 'jobs', 'communities', 'premium',
  'lists', 'bookmarks', 'hashtag',
]);

function handleFromPath(path: string, wholePathOnly: boolean): string | null {
  const re = wholePathOnly ? /^\/([A-Za-z0-9_]{1,15})\/?$/ : /^\/([A-Za-z0-9_]{1,15})(?:\/|$)/;
  const name = re.exec(path)?.[1];
  if (!name || RESERVED.has(name.toLowerCase())) return null;
  return name;
}

export const x: SiteAdapter = {
  id: 'x',
  label: 'X / Twitter',
  hosts: ['x.com', 'twitter.com'],
  itemSelector: 'article[data-testid="tweet"]',
  extract(el) {
    const sources: SourceRef[] = [...linkDomains(el)];
    el.querySelectorAll('a[href^="/"][role="link"]').forEach((a) => {
      const handle = handleFromPath(a.getAttribute('href') ?? '', true);
      if (handle) sources.push({ kind: 'x-user', handle });
    });
    return { text: richText(el), sources: dedupeSources(sources) };
  },
  pageSource(url) {
    const handle = handleFromPath(url.pathname, false);
    return handle ? { kind: 'x-user', handle } : null;
  },
  expectsItems: (url) => /^\/(home|search)\b/.test(url.pathname),
};

import type { SourceRef } from '../core/model';
import { dedupeSources, richText } from './dom';
import type { SiteAdapter } from './types';

// Top-level GitHub paths that are routes, not owners.
const RESERVED = new Set([
  'orgs', 'dashboard', 'search', 'notifications', 'settings', 'marketplace', 'explore',
  'topics', 'trending', 'sponsors', 'features', 'pulls', 'issues', 'codespaces', 'new',
  'login', 'logout', 'join', 'about', 'pricing', 'contact', 'apps', 'collections',
  'events', 'stars', 'watching', 'account', 'organizations', 'users', 'site', 'security',
  'home', 'customer-stories', 'readme',
]);

// Owner of the current page: "/owner", "/owner/repo/…", "/orgs/owner/…".
export function ownerFromPath(pathname: string): string | null {
  const [first, second] = pathname.split('/').filter(Boolean);
  if (!first) return null;
  const owner = (first === 'orgs' && second ? second : first).toLowerCase();
  return RESERVED.has(owner) ? null : owner;
}

// Owner of a repo/owner ROOT link only ("/owner" or "/owner/repo"), not deep links.
export function repoOwnerFromHref(href: string): string | null {
  const path = href.split(/[?#]/)[0] ?? '';
  const m = /^\/([^/]+)(?:\/([^/]+))?\/?$/.exec(path);
  if (!m) return null;
  const owner = m[1]?.toLowerCase();
  if (!owner || RESERVED.has(owner)) return null;
  return owner;
}

// Source-only: GitHub is a work tool, so keywords never hide issues/PRs here (same as
// no-ai-filter). Work orgs are github-owner sources on the Work topic.
export const github: SiteAdapter = {
  id: 'github',
  label: 'GitHub',
  hosts: ['github.com'],
  sourcesOnly: true,
  itemSelector:
    '[data-testid="results-list"] > div, #user-repositories-list li, #org-repositories li, .Box-row, .feed-item, [data-testid="list-view-item"]',
  extract(el) {
    const sources: SourceRef[] = [];
    el.querySelectorAll('a[href^="/"]').forEach((a) => {
      const owner = repoOwnerFromHref(a.getAttribute('href') ?? '');
      if (owner) sources.push({ kind: 'github-owner', owner });
    });
    return { text: richText(el), sources: dedupeSources(sources) };
  },
  pageSource(url) {
    const owner = ownerFromPath(url.pathname);
    return owner ? { kind: 'github-owner', owner } : null;
  },
};

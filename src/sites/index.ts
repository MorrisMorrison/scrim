import { hostMatches } from '../core/host';
import { github } from './github';
import { googleNews, googleSearch, hideAiOverview } from './google';
import { hackerNews } from './hackernews';
import { reddit } from './reddit';
import type { SiteAdapter, Tweak } from './types';
import { x } from './x';
import { youtube, YOUTUBE_TWEAKS } from './youtube';

export type { SiteAdapter, Tweak } from './types';

export const ADAPTERS: readonly SiteAdapter[] = [
  reddit,
  youtube,
  x,
  hackerNews,
  googleSearch,
  googleNews,
  github,
];

export function adapterForHost(host: string): SiteAdapter | null {
  return (
    ADAPTERS.find(
      (a) => (!a.appliesTo || a.appliesTo(host)) && a.hosts.some((h) => hostMatches(host, h)),
    ) ?? null
  );
}

export const TWEAKS: readonly Tweak[] = [...YOUTUBE_TWEAKS, hideAiOverview];

export function tweaksForSite(siteId: string): Tweak[] {
  return TWEAKS.filter((t) => t.site === siteId);
}

// Content-script match patterns. "*.example.com" also matches example.com itself.
export const CONTENT_MATCHES: string[] = [
  '*://*.reddit.com/*',
  '*://*.youtube.com/*',
  '*://*.x.com/*',
  '*://*.twitter.com/*',
  '*://news.ycombinator.com/*',
  '*://www.google.com/*',
  '*://news.google.com/*',
  '*://github.com/*',
];

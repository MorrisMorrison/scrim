import type { SourceRef } from '../core/model';
import { dedupeSources, richText } from './dom';
import type { SiteAdapter, Tweak } from './types';

function handleFromHref(href: string): string | null {
  const m = /^\/@([^/?#]+)/.exec(href);
  const raw = m?.[1];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// Home grid, search, sidebar, grid, reels, the newer lockup view-model, in-feed ads.
export const youtube: SiteAdapter = {
  id: 'youtube',
  label: 'YouTube',
  hosts: ['youtube.com'],
  itemSelector:
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-reel-item-renderer, ytd-rich-grid-slim-media, yt-lockup-view-model, ytd-ad-slot-renderer',
  extract(el) {
    const sources: SourceRef[] = [];
    el.querySelectorAll('a[href^="/@"]').forEach((a) => {
      const handle = handleFromHref(a.getAttribute('href') ?? '');
      if (handle) sources.push({ kind: 'channel', handle });
    });
    return { text: richText(el), sources: dedupeSources(sources) };
  },
  pageSource(url) {
    const handle = handleFromHref(url.pathname);
    return handle ? { kind: 'channel', handle } : null;
  },
  // Home grid, search results, the watch-page sidebar and subscriptions.
  expectsItems: (url) => /^\/($|results|watch|feed\/subscriptions)/.test(url.pathname),
};

export function shortsRedirectTarget(url: URL): string | null {
  const m = /^\/shorts\/([\w-]+)/.exec(url.pathname);
  return m ? `/watch?v=${m[1]}` : null;
}

const hide = (selectors: string[]) => `${selectors.join(',\n')} { display: none !important; }`;

export const YOUTUBE_TWEAKS: Tweak[] = [
  {
    id: 'youtube.hideShorts',
    site: 'youtube',
    label: 'Hide Shorts',
    css: hide([
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-reel-shelf-renderer',
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
      'ytd-guide-entry-renderer:has(a[title="Shorts"])',
      'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
      'yt-tab-shape[tab-title="Shorts"]',
      'ytd-video-renderer:has(a[href^="/shorts/"])',
      'ytd-rich-item-renderer:has(a[href^="/shorts/"])',
    ]),
    // /shorts/<id> opens in the normal player, on load and on in-app navigation.
    run(doc) {
      const check = () => {
        const target = shortsRedirectTarget(new URL(doc.location.href));
        if (target) doc.location.replace(target);
      };
      check();
      doc.addEventListener('yt-navigate-finish', check);
      return () => doc.removeEventListener('yt-navigate-finish', check);
    },
  },
  {
    id: 'youtube.hideHomeRecommendations',
    site: 'youtube',
    label: 'Hide home page recommendations',
    css: hide(['ytd-browse[page-subtype="home"] ytd-rich-grid-renderer']),
  },
  {
    id: 'youtube.hideWatchRecommendations',
    site: 'youtube',
    label: 'Hide recommendations next to videos',
    css: hide(['ytd-watch-flexy #secondary #related', 'ytd-watch-next-secondary-results-renderer']),
  },
  {
    id: 'youtube.hideEndScreens',
    site: 'youtube',
    label: 'Hide end screens',
    css: hide(['.ytp-ce-element', '.ytp-endscreen-content', '.ytp-fullscreen-grid', '.videowall-endscreen']),
  },
  {
    id: 'youtube.hideComments',
    site: 'youtube',
    label: 'Hide comments',
    css: hide(['ytd-comments#comments']),
  },
  {
    id: 'youtube.hideExplore',
    site: 'youtube',
    label: 'Hide Explore / Trending',
    css: hide([
      'ytd-guide-section-renderer:has(a[href^="/feed/trending"])',
      'ytd-guide-entry-renderer:has(a[href^="/feed/explore"])',
      'ytd-guide-entry-renderer:has(a[href^="/feed/trending"])',
    ]),
  },
];

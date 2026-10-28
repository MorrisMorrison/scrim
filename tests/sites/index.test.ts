import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILES } from '../../src/core/defaults';
import { ADAPTERS, adapterForHost, TWEAKS, tweaksForSite } from '../../src/sites';

describe('site registry', () => {
  it('routes hosts to adapters', () => {
    expect(adapterForHost('www.youtube.com')?.id).toBe('youtube');
    expect(adapterForHost('m.youtube.com')?.id).toBe('youtube');
    expect(adapterForHost('old.reddit.com')?.id).toBe('reddit');
    expect(adapterForHost('twitter.com')?.id).toBe('x');
    expect(adapterForHost('news.ycombinator.com')?.id).toBe('hackernews');
    expect(adapterForHost('www.google.com')?.id).toBe('google-search');
    expect(adapterForHost('news.google.com')?.id).toBe('google-news');
    expect(adapterForHost('github.com')?.id).toBe('github');
    expect(adapterForHost('example.com')).toBeNull();
  });

  it('every tweak belongs to a known adapter and has a unique id', () => {
    const ids = new Set(ADAPTERS.map((a) => a.id));
    for (const t of TWEAKS) expect(ids.has(t.site), t.id).toBe(true);
    expect(new Set(TWEAKS.map((t) => t.id)).size).toBe(TWEAKS.length);
  });

  it('every tweak used by a default profile exists', () => {
    const known = new Set(TWEAKS.map((t) => t.id));
    for (const p of DEFAULT_PROFILES) for (const id of Object.keys(p.tweaks)) expect(known.has(id), id).toBe(true);
  });

  it('groups tweaks per site', () => {
    expect(tweaksForSite('google-search').map((t) => t.id)).toEqual(['google.hideAiOverview']);
    expect(tweaksForSite('youtube')).toHaveLength(6);
  });
});

describe('expectsItems (health check)', () => {
  const expects = (host: string, path: string) => {
    const adapter = adapterForHost(host);
    return adapter?.expectsItems?.(new URL(`https://${host}${path}`)) ?? false;
  };

  it('is true on feed pages', () => {
    for (const [host, path] of [
      ['www.reddit.com', '/'],
      ['www.reddit.com', '/r/gardening/'],
      ['www.reddit.com', '/best/'],
      ['www.youtube.com', '/'],
      ['www.youtube.com', '/results?search_query=bread'],
      ['www.youtube.com', '/watch?v=abc'],
      ['www.youtube.com', '/feed/subscriptions'],
      ['x.com', '/home'],
      ['x.com', '/search?q=cats'],
      ['news.ycombinator.com', '/'],
      ['news.ycombinator.com', '/newest'],
      ['www.google.com', '/search?q=bread'],
      ['news.google.com', '/home'],
    ]) {
      expect(expects(host as string, path as string), `${host}${path}`).toBe(true);
    }
  });

  it('is false where a page can legitimately have no items', () => {
    for (const [host, path] of [
      ['www.reddit.com', '/settings'],
      ['www.youtube.com', '/account'],
      ['x.com', '/settings/account'],
      ['news.ycombinator.com', '/item?id=1'],
      ['www.google.com', '/'],
      ['www.google.com', '/search?q=bread&udm=2'],
      ['www.google.com', '/search?q=bread&tbm=isch'],
      ['github.com', '/torvalds/linux'],
    ]) {
      expect(expects(host as string, path as string), `${host}${path}`).toBe(false);
    }
  });
});

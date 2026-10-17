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

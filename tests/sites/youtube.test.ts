// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { shortsRedirectTarget, youtube, YOUTUBE_TWEAKS } from '../../src/sites/youtube';
import { loadFixture } from '../helpers/fixture';

const byId = (id: string) => document.getElementById(id) as Element;

describe('youtube adapter', () => {
  beforeEach(() => loadFixture('youtube/home.html'));

  it('selects grid items and lockups', () => {
    expect(document.querySelectorAll(youtube.itemSelector)).toHaveLength(3);
  });

  it('extracts title text and channel handles', () => {
    const facts = youtube.extract(byId('ai-video'));
    expect(facts.text).toContain('I built an AI agent');
    expect(facts.sources).toEqual([{ kind: 'channel', handle: 'TechGuy' }]);
  });

  it('decodes percent-encoded handles', () => {
    expect(youtube.extract(byId('lockup')).sources).toEqual([{ kind: 'channel', handle: 'lockupé' }]);
  });

  it('knows the channel that owns a page', () => {
    expect(youtube.pageSource?.(new URL('https://www.youtube.com/@TechGuy/videos'))).toEqual({
      kind: 'channel',
      handle: 'TechGuy',
    });
    expect(youtube.pageSource?.(new URL('https://www.youtube.com/watch?v=aaa'))).toBeNull();
  });
});

describe('youtube tweaks', () => {
  it('redirects Shorts URLs to the normal player', () => {
    expect(shortsRedirectTarget(new URL('https://www.youtube.com/shorts/abc_123'))).toBe('/watch?v=abc_123');
    expect(shortsRedirectTarget(new URL('https://www.youtube.com/watch?v=abc'))).toBeNull();
  });

  it('declares every v1 tweak with CSS for the youtube adapter', () => {
    expect(YOUTUBE_TWEAKS.map((t) => t.id)).toEqual([
      'youtube.hideShorts',
      'youtube.hideHomeRecommendations',
      'youtube.hideWatchRecommendations',
      'youtube.hideEndScreens',
      'youtube.hideComments',
      'youtube.hideExplore',
    ]);
    for (const t of YOUTUBE_TWEAKS) {
      expect(t.site).toBe('youtube');
      expect(t.css).toMatch(/display:\s*none !important/);
    }
  });
});

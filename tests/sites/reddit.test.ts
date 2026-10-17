// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { reddit } from '../../src/sites/reddit';
import { loadFixture } from '../helpers/fixture';

const byId = (id: string) => document.getElementById(id) as Element;

describe('reddit adapter', () => {
  beforeEach(() => loadFixture('reddit/feed.html'));

  it('selects every feed card, ads included', () => {
    for (const id of ['ai-post', 'garden-post', 'ad-post']) {
      expect(byId(id).matches(reddit.itemSelector), id).toBe(true);
    }
  });

  it('extracts the subreddit once, from attributes and links', () => {
    expect(reddit.extract(byId('ai-post')).sources).toEqual([{ kind: 'subreddit', name: 'ChatGPT' }]);
  });

  it('extracts external link domains', () => {
    expect(reddit.extract(byId('garden-post')).sources).toContainEqual({
      kind: 'domain',
      host: 'the-decoder.de',
    });
  });

  it('reads image alt text of image-only ads', () => {
    expect(reddit.extract(byId('ad-post')).text).toContain('Try our AI assistant today');
  });

  it('knows the subreddit that owns a page', () => {
    expect(reddit.pageSource?.(new URL('https://www.reddit.com/r/ChatGPT/top/'))).toEqual({
      kind: 'subreddit',
      name: 'ChatGPT',
    });
    expect(reddit.pageSource?.(new URL('https://www.reddit.com/'))).toBeNull();
  });
});

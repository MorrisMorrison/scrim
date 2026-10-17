// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { findAiOverviewBlocks, googleSearch, hideAiOverview } from '../../src/sites/google';
import { loadFixture } from '../helpers/fixture';

describe('google search adapter', () => {
  beforeEach(() => loadFixture('google/search.html'));

  it('selects organic results and extracts their domains', () => {
    const items = document.querySelectorAll(googleSearch.itemSelector);
    expect(items).toHaveLength(2);
    expect(googleSearch.extract(items[0] as Element).sources).toEqual([{ kind: 'domain', host: 'openai.com' }]);
  });

  it('applies to www.google.com only', () => {
    expect(googleSearch.appliesTo?.('www.google.com')).toBe(true);
    expect(googleSearch.appliesTo?.('news.google.com')).toBe(false);
  });
});

describe('AI Overview', () => {
  beforeEach(() => loadFixture('google/search.html'));

  it('finds known containers and heading-labelled blocks without climbing past the results column', () => {
    const ids = findAiOverviewBlocks(document).map((el) => el.id);
    expect(ids).toEqual(['aio-known', 'aio-wrap']);
  });

  it('the tweak hides them and restores them on cleanup', () => {
    const cleanup = hideAiOverview.run?.(document) ?? (() => {});
    const wrap = document.getElementById('aio-wrap') as HTMLElement;
    expect(wrap.style.display).toBe('none');
    cleanup();
    expect(wrap.style.display).toBe('');
  });
});

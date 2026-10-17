// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('a frame queued before cleanup does nothing after it', async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    try {
      const cleanup = hideAiOverview.run?.(document) ?? (() => {});
      (document.getElementById('rso') as HTMLElement).insertAdjacentHTML(
        'beforebegin',
        '<div id="aio-late"><h2>AI Overview</h2><div>Late answer</div></div>',
      );
      await vi.waitFor(() => expect(frames).toHaveLength(1));
      cleanup();
      frames[0]?.(0);
      expect((document.getElementById('aio-late') as HTMLElement).style.display).toBe('');
      expect(document.querySelector('[data-scrim-aio]')).toBeNull();
    } finally {
      raf.mockRestore();
    }
  });
});

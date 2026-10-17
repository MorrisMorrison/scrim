// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIO_WATCH_MS, findAiOverviewBlocks, googleSearch, hideAiOverview } from '../../src/sites/google';
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

  const nextFrame = async () => {
    await Promise.resolve();
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  };

  it('unrelated additions trigger no document-wide query', async () => {
    const cleanup = hideAiOverview.run?.(document) ?? (() => {});
    const qsa = vi.spyOn(document, 'querySelectorAll');
    try {
      (document.getElementById('rso') as HTMLElement).appendChild(document.createElement('span'));
      await nextFrame();
      expect(qsa).not.toHaveBeenCalled();
    } finally {
      qsa.mockRestore();
      cleanup();
    }
  });

  it('hides an overview that arrives later inside a new block', async () => {
    const cleanup = hideAiOverview.run?.(document) ?? (() => {});
    (document.getElementById('rso') as HTMLElement).insertAdjacentHTML(
      'afterbegin',
      '<div id="late"><div><h2>KI-Übersicht</h2><p>answer</p></div></div>',
    );
    await nextFrame();
    expect(document.querySelector('#late h2')?.closest('[data-scrim-aio]')).not.toBeNull();
    cleanup();
  });

  it('catches heading text that is filled in later', async () => {
    (document.getElementById('rso') as HTMLElement).insertAdjacentHTML(
      'afterbegin',
      '<div id="shell"><div><h2 id="empty-heading"></h2><p>answer</p></div></div>',
    );
    const cleanup = hideAiOverview.run?.(document) ?? (() => {});
    (document.getElementById('empty-heading') as HTMLElement).textContent = 'AI Overview';
    await nextFrame();
    expect(document.querySelector('#shell h2')?.closest('[data-scrim-aio]')).not.toBeNull();
    cleanup();
  });

  it(`stops watching the page after ${AIO_WATCH_MS} ms`, async () => {
    vi.useFakeTimers();
    try {
      const cleanup = hideAiOverview.run?.(document) ?? (() => {});
      vi.advanceTimersByTime(AIO_WATCH_MS);
      const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
      (document.getElementById('rso') as HTMLElement).insertAdjacentHTML(
        'afterbegin',
        '<div id="too-late"><h2>AI Overview</h2></div>',
      );
      await Promise.resolve();
      vi.advanceTimersByTime(50);
      expect(raf).not.toHaveBeenCalled();
      raf.mockRestore();
      cleanup();
    } finally {
      vi.useRealTimers();
    }
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

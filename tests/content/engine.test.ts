// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine, type EngineOptions } from '../../src/content/engine';
import type { Action, Topic } from '../../src/core/model';
import { buildPipeline } from '../../src/core/pipeline';
import type { SiteAdapter } from '../../src/sites/types';

const ai: Topic = {
  id: 'ai',
  name: 'AI',
  keywords: ['LLM'],
  sources: [{ kind: 'subreddit', name: 'ChatGPT' }],
  blockSites: [],
};

const adapter: SiteAdapter = {
  id: 'test',
  label: 'Test',
  hosts: ['localhost'],
  itemSelector: '.item',
  extract: (el) => {
    const src = (el as HTMLElement).dataset.src;
    return { text: el.textContent ?? '', sources: src ? [{ kind: 'subreddit', name: src }] : [] };
  },
};

const config = (action: Action = 'hide') => ({
  pipeline: buildPipeline([ai]),
  action,
  topicNames: { ai: 'AI' },
});

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const state = (id: string) => $(id).getAttribute('data-scrim');

// Lets the observer's microtask run, then the frame it queued.
async function nextFrame(): Promise<void> {
  await Promise.resolve();
  for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(() => r(undefined)));
}

let engine: Engine | null = null;
function setup(html: string, opts: Partial<EngineOptions> = {}): Engine {
  document.body.innerHTML = html;
  engine = new Engine({ adapter, doc: document, ...opts });
  return engine;
}

beforeEach(() => {
  document.documentElement.className = '';
});

afterEach(() => {
  engine?.stop();
  engine = null;
  vi.useRealTimers();
});

describe('Engine', () => {
  it('hides keyword hits, passes the rest, and logs/counts hits', () => {
    const e = setup('<div class="item" id="a">an LLM post</div><div class="item" id="b">cats</div>');
    e.configure(config());
    expect(state('a')).toBe('hit:ai');
    expect($('a').classList.contains('scrim-hidden')).toBe(true);
    expect(state('b')).toBe('pass');
    expect(e.total()).toBe(1);
    expect(e.getCounts()).toEqual({ ai: 1 });
    expect(e.getLog()).toEqual([{ snippet: 'an LLM post', topicId: 'ai', reason: 'keyword "LLM"' }]);
  });

  it('hides source hits', () => {
    const e = setup('<div class="item" id="a" data-src="chatgpt">hello</div>');
    e.configure(config());
    expect(state('a')).toBe('hit:ai');
    expect(e.getLog()[0]?.reason).toBe('source r/chatgpt');
  });

  it('does nothing with an empty pipeline', () => {
    const e = setup('<div class="item" id="a">LLM</div>');
    e.configure({ ...config(), pipeline: buildPipeline([]) });
    expect(state('a')).toBeNull();
  });

  it('blur action: click reveals the item', () => {
    const e = setup('<div class="item" id="a">LLM</div>');
    e.configure(config('blur'));
    expect($('a').classList.contains('scrim-blurred')).toBe(true);
    $('a').click();
    expect($('a').classList.contains('scrim-blurred')).toBe(false);
    expect(state('a')).toBe('hit:ai');
  });

  it('collapse action: inserts a bar whose button reveals the item', () => {
    const e = setup('<div class="item" id="a">LLM</div>');
    e.configure(config('collapse'));
    const bar = $('a').previousElementSibling as HTMLElement;
    expect(bar.hasAttribute('data-scrim-bar')).toBe(true);
    expect(bar.textContent).toContain('Scrim · AI');
    (bar.querySelector('button') as HTMLButtonElement).click();
    expect($('a').classList.contains('scrim-hidden')).toBe(false);
    expect(document.querySelector('[data-scrim-bar]')).toBeNull();
  });

  it('keeps empty items pending until text arrives', () => {
    vi.useFakeTimers();
    const e = setup('<div class="item" id="a"></div>');
    e.configure(config());
    expect(state('a')).toBeNull();
    $('a').textContent = 'now an LLM post';
    e.scan();
    expect(state('a')).toBe('hit:ai');
  });

  it('fails open: passes items that stay empty past the timeout', () => {
    vi.useFakeTimers();
    const e = setup('<div class="item" id="a"></div>');
    e.configure(config());
    vi.advanceTimersByTime(799);
    expect(state('a')).toBeNull();
    vi.advanceTimersByTime(1);
    expect(state('a')).toBe('pass');
  });

  it('fails open when extract throws', () => {
    const broken: SiteAdapter = {
      ...adapter,
      extract: () => {
        throw new Error('boom');
      },
    };
    setup('<div class="item" id="a">LLM</div>', { adapter: broken }).configure(config());
    expect(state('a')).toBe('pass');
  });

  it('counts nested items once', () => {
    const e = setup('<div class="item" id="outer">LLM <div class="item" id="inner">inner</div></div>');
    e.configure(config());
    expect(state('outer')).toBe('hit:ai');
    expect(state('inner')).toBe('pass');
    expect(e.total()).toBe(1);
  });

  it('hides related elements with the item', () => {
    const withRelated: SiteAdapter = { ...adapter, related: (el) => [el.nextElementSibling as Element] };
    setup('<div class="item" id="a">LLM</div><div id="r">meta</div>', { adapter: withRelated }).configure(
      config(),
    );
    expect(state('r')).toBe('hit:ai');
    expect($('r').classList.contains('scrim-hidden')).toBe(true);
  });

  it('source-only adapters ignore keywords', () => {
    setup('<div class="item" id="a">LLM</div>', { adapter: { ...adapter, sourcesOnly: true } }).configure(config());
    expect(state('a')).toBe('pass');
  });

  it('re-configuring resets and re-evaluates', () => {
    const e = setup('<div class="item" id="a">LLM</div>');
    e.configure(config('hide'));
    e.configure(config('blur'));
    expect($('a').classList.contains('scrim-hidden')).toBe(false);
    expect($('a').classList.contains('scrim-blurred')).toBe(true);
    expect(e.total()).toBe(1);
    e.configure(null);
    expect(state('a')).toBeNull();
    expect(e.total()).toBe(0);
  });

  it('toggles reveal mode on the root element', () => {
    const e = setup('');
    e.setReveal(true);
    expect(document.documentElement.classList.contains('scrim-reveal')).toBe(true);
    expect(e.isRevealed()).toBe(true);
    e.setReveal(false);
    expect(document.documentElement.classList.contains('scrim-reveal')).toBe(false);
  });

  // Failure isolation: one broken item must never leave itself or later items stuck pending.
  it.each([
    [
      'related() throws',
      () => {
        throw new Error('boom');
      },
    ],
    ['related() returns a null entry', () => [null as unknown as Element]],
  ])('fails open when %s, and still evaluates later items', (_name, related) => {
    const broken: SiteAdapter = { ...adapter, related };
    const e = setup('<div class="item" id="a">first LLM</div><div class="item" id="b">cats</div>', {
      adapter: broken,
    });
    e.configure(config());
    // The failing item is shown (pass), without a hide class, and not counted.
    expect(state('a')).toBe('pass');
    expect($('a').classList.contains('scrim-hidden')).toBe(false);
    expect(e.total()).toBe(0);
    // The later item was still evaluated rather than left pending.
    expect(state('b')).toBe('pass');
  });

  it('a failing related() on one item does not stop later items from being hit', () => {
    const flaky: SiteAdapter = {
      ...adapter,
      related: (el) => {
        if (el.id === 'a') throw new Error('boom');
        return [];
      },
    };
    const e = setup('<div class="item" id="a">first LLM</div><div class="item" id="b">second LLM</div>', {
      adapter: flaky,
    });
    e.configure(config());
    expect(state('a')).toBe('pass');
    expect(state('b')).toBe('hit:ai');
    expect($('b').classList.contains('scrim-hidden')).toBe(true);
    expect(e.total()).toBe(1);
  });

  it('a throwing onHit does not affect the hit item or later items', () => {
    const onHit = vi.fn(() => {
      throw new Error('Extension context invalidated');
    });
    const e = setup('<div class="item" id="a">first LLM</div><div class="item" id="b">second LLM</div>', {
      onHit,
    });
    e.configure(config());
    expect(state('a')).toBe('hit:ai');
    expect($('a').classList.contains('scrim-hidden')).toBe(true);
    expect(state('b')).toBe('hit:ai');
    expect(onHit).toHaveBeenCalledTimes(2);
    expect(e.total()).toBe(2);
  });

  it('does not scan from a queued frame after stop()', async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    try {
      const e = setup('');
      e.configure(config());
      e.start();
      document.body.insertAdjacentHTML('beforeend', '<div class="item" id="n">late LLM post</div>');
      await vi.waitFor(() => expect(frames).toHaveLength(1));
      e.stop();
      frames[0]?.(0);
      expect(state('n')).toBeNull();
    } finally {
      raf.mockRestore();
    }
  });

  it('picks up items added after start()', async () => {
    const e = setup('');
    e.configure(config());
    e.start();
    document.body.insertAdjacentHTML('beforeend', '<div class="item" id="n">late LLM post</div>');
    await vi.waitFor(() => expect(state('n')).toBe('hit:ai'));
  });

  // YouTube and Reddit reuse item elements for new content.
  describe('reused item elements', () => {
    it('a passed item whose content changes is re-evaluated (becomes hit) on scan()', () => {
      const e = setup('<div class="item" id="a"><a href="/v/1">cats</a></div>');
      e.configure(config());
      expect(state('a')).toBe('pass');
      $('a').innerHTML = '<a href="/v/2">an LLM explainer</a>';
      e.scan();
      expect(state('a')).toBe('hit:ai');
      expect($('a').classList.contains('scrim-hidden')).toBe(true);
      expect(e.total()).toBe(1);
    });

    it('a hit item whose content changes to harmless content is shown again on scan()', () => {
      const withRelated: SiteAdapter = { ...adapter, related: (el) => [el.nextElementSibling as Element] };
      const e = setup('<div class="item" id="a"><a href="/v/1">LLM news</a></div><div id="r">meta</div>', {
        adapter: withRelated,
      });
      e.configure(config('collapse'));
      expect(state('a')).toBe('hit:ai');
      expect(document.querySelector('[data-scrim-bar]')).not.toBeNull();
      $('a').innerHTML = '<a href="/v/2">cats</a>';
      e.scan();
      expect(state('a')).toBe('pass');
      expect($('a').classList.contains('scrim-hidden')).toBe(false);
      expect(document.querySelector('[data-scrim-bar]')).toBeNull();
      expect(state('r')).toBeNull();
      expect($('r').classList.contains('scrim-hidden')).toBe(false);
    });

    it('an unchanged item keeps its state and is not counted again', () => {
      const e = setup('<div class="item" id="a">LLM</div><div class="item" id="b">cats</div>');
      e.configure(config());
      e.scan();
      expect(state('a')).toBe('hit:ai');
      expect(state('b')).toBe('pass');
      expect(e.total()).toBe(1);
    });

    it('a passed item whose link changes to a new target with an LLM title becomes a hit', () => {
      const e = setup('<div class="item" id="a"><a href="/v/1">cats</a> <span>3 hr. ago</span></div>');
      e.configure(config());
      expect(state('a')).toBe('pass');
      const link = $('a').querySelector('a') as HTMLAnchorElement;
      link.setAttribute('href', '/v/2');
      link.textContent = 'an LLM explainer';
      e.scan();
      expect(state('a')).toBe('hit:ai');
      expect(e.total()).toBe(1);
    });

    it('a hit item whose non-link text changes keeps its state, reveal and count', async () => {
      const e = setup('<div class="item" id="a"><a href="/v/1">LLM news</a> <span id="t">3 hr. ago</span></div>');
      e.configure(config('blur'));
      e.start();
      $('a').click(); // the user unblurs it
      expect($('a').classList.contains('scrim-blurred')).toBe(false);
      $('t').textContent = '4 hr. ago';
      await nextFrame();
      e.scan();
      expect(state('a')).toBe('hit:ai');
      expect($('a').classList.contains('scrim-blurred')).toBe(false);
      expect(e.total()).toBe(1);
      expect(e.getLog()).toHaveLength(1);
    });

    it('an item without a link falls back to its text', () => {
      const e = setup('<div class="item" id="a">cats</div>');
      e.configure(config());
      $('a').textContent = 'an LLM post';
      e.scan();
      expect(state('a')).toBe('hit:ai');
    });

    it('after start(), a link change alone re-evaluates the item', async () => {
      const e = setup('<div class="item" id="a"><a href="/v/1">cats</a></div>');
      e.configure(config());
      e.start();
      expect(state('a')).toBe('pass');
      const link = $('a').querySelector('a') as HTMLAnchorElement;
      // In-place text update (no childList record): only the href change reports the reuse.
      (link.firstChild as Text).data = 'an LLM post';
      link.setAttribute('href', '/v/2');
      await vi.waitFor(() => expect(state('a')).toBe('hit:ai'));
    });

    it('after start(), a frame only re-checks the items that mutated', async () => {
      const extract = vi.fn(adapter.extract);
      const e = setup('<div class="item" id="a">cats</div><div class="item" id="b">dogs</div>', {
        adapter: { ...adapter, extract },
      });
      e.configure(config());
      e.start();
      extract.mockClear();
      $('a').textContent = 'birds';
      await vi.waitFor(() => expect(extract).toHaveBeenCalled());
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const ids = extract.mock.calls.map(([el]) => el.id);
      expect(ids).toContain('a');
      expect(ids).not.toContain('b');
    });
  });
});

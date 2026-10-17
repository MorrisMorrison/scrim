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

  it('picks up items added after start()', async () => {
    const e = setup('');
    e.configure(config());
    e.start();
    document.body.insertAdjacentHTML('beforeend', '<div class="item" id="n">late LLM post</div>');
    await vi.waitFor(() => expect(state('n')).toBe('hit:ai'));
  });
});

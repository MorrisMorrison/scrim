// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveFeedbackSource } from '../../src/content/feedback';
import { hideToast, showToast, TOAST_ID, TOAST_MS } from '../../src/content/toast';
import type { SiteAdapter } from '../../src/sites/types';

const adapter: SiteAdapter = {
  id: 'test',
  label: 'Test',
  hosts: ['localhost'],
  itemSelector: '.item',
  extract: (el) => {
    const src = (el as HTMLElement).dataset.src;
    return {
      text: el.textContent ?? '',
      sources: [
        { kind: 'domain', host: 'example.org' },
        ...(src ? [{ kind: 'subreddit' as const, name: src }] : []),
      ],
    };
  },
};

describe('resolveFeedbackSource', () => {
  it('finds the post around the right-clicked element and its most specific source', () => {
    document.body.innerHTML = '<div class="item" data-src="gardening"><p><a id="t">title</a></p></div>';
    expect(resolveFeedbackSource(document.getElementById('t'), adapter)).toEqual({
      ok: true,
      source: { kind: 'subreddit', name: 'gardening' },
    });
  });

  it('explains when nothing usable was right-clicked', () => {
    document.body.innerHTML = '<p id="outside">not a post</p>';
    expect(resolveFeedbackSource(document.getElementById('outside'), adapter)).toEqual({
      ok: false,
      message: 'Right-click a post to use Scrim here.',
    });
    expect(resolveFeedbackSource(null, adapter).ok).toBe(false);
  });

  it('explains when the post has no source', () => {
    document.body.innerHTML = '<div class="item" id="i">x</div>';
    const bare: SiteAdapter = { ...adapter, extract: () => ({ text: 'x', sources: [] }) };
    expect(resolveFeedbackSource(document.getElementById('i'), bare)).toEqual({
      ok: false,
      message: "Scrim couldn't find a source for this post.",
    });
  });

  it('survives an adapter that throws', () => {
    document.body.innerHTML = '<div class="item" id="i">x</div>';
    const broken: SiteAdapter = {
      ...adapter,
      extract: () => {
        throw new Error('boom');
      },
    };
    expect(resolveFeedbackSource(document.getElementById('i'), broken).ok).toBe(false);
  });
});

describe('toast', () => {
  afterEach(() => {
    hideToast(document);
    vi.useRealTimers();
  });

  const shadow = () => document.getElementById(TOAST_ID)?.shadowRoot;

  it('shows a message with an Undo action in its own shadow root', () => {
    const undo = vi.fn();
    showToast(document, 'Hiding r/gardening under Work', undo);
    expect(shadow()?.textContent).toContain('Hiding r/gardening under Work');
    (shadow()?.querySelector('button') as HTMLButtonElement).click();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(document.getElementById(TOAST_ID)).toBeNull();
  });

  it('replaces the previous toast and has no Undo without a callback', () => {
    showToast(document, 'first');
    showToast(document, 'second');
    expect(document.querySelectorAll(`#${TOAST_ID}`)).toHaveLength(1);
    expect(shadow()?.textContent).toContain('second');
    expect(shadow()?.querySelector('button')).toBeNull();
  });

  it('goes away on its own', () => {
    vi.useFakeTimers();
    showToast(document, 'bye');
    vi.advanceTimersByTime(TOAST_MS);
    expect(document.getElementById(TOAST_ID)).toBeNull();
  });
});

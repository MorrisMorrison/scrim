// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hidePageBlock, OVERLAY_ID, showPageBlock } from '../../src/content/overlay';

describe('page-block overlay', () => {
  beforeEach(() => hidePageBlock(document));

  it('shows once, with message, detail and a peek button', () => {
    const onPeek = vi.fn();
    showPageBlock(document, { message: 'gh:acme-corp can wait.', detail: 'Work · Downtime', onPeek });
    expect(document.querySelectorAll(`#${OVERLAY_ID}`)).toHaveLength(1);
    const overlay = document.getElementById(OVERLAY_ID) as HTMLElement;
    expect(overlay.textContent).toContain('gh:acme-corp can wait.');
    expect(overlay.textContent).toContain('Work · Downtime');
    (overlay.querySelector('button') as HTMLButtonElement).click();
    expect(onPeek).toHaveBeenCalledTimes(1);
  });

  // SPA navigation from one blocked page to another: the overlay must describe the new page.
  it('replaces the content of an existing overlay', () => {
    const first = vi.fn();
    const second = vi.fn();
    showPageBlock(document, { message: 'gh:acme-corp can wait.', detail: 'Work · Downtime', onPeek: first });
    showPageBlock(document, { message: 'gh:globex can wait.', detail: 'Work · Evening', onPeek: second });
    expect(document.querySelectorAll(`#${OVERLAY_ID}`)).toHaveLength(1);
    const overlay = document.getElementById(OVERLAY_ID) as HTMLElement;
    expect(overlay.textContent).toContain('gh:globex can wait.');
    expect(overlay.textContent).toContain('Work · Evening');
    expect(overlay.textContent).not.toContain('acme-corp');
    expect(overlay.querySelectorAll('button')).toHaveLength(1);
    (overlay.querySelector('button') as HTMLButtonElement).click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  // GitHub (Turbo) swaps <body> on navigation; an overlay inside it would vanish.
  it('lives on the root element and survives a <body> swap', () => {
    showPageBlock(document, { message: 'm', detail: 'd', onPeek: () => {} });
    const overlay = document.getElementById(OVERLAY_ID) as HTMLElement;
    expect(overlay.parentElement).toBe(document.documentElement);
    document.documentElement.replaceChild(document.createElement('body'), document.body);
    expect(document.getElementById(OVERLAY_ID)).toBe(overlay);
  });

  it('hides', () => {
    showPageBlock(document, { message: 'm', detail: 'd', onPeek: () => {} });
    hidePageBlock(document);
    expect(document.getElementById(OVERLAY_ID)).toBeNull();
  });
});

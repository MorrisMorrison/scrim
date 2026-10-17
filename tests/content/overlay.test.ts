// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hidePageBlock, OVERLAY_ID, showPageBlock } from '../../src/content/overlay';

describe('page-block overlay', () => {
  beforeEach(() => hidePageBlock(document));

  it('shows once, with message, detail and a peek button', () => {
    const onPeek = vi.fn();
    showPageBlock(document, { message: 'gh:acme-corp can wait.', detail: 'Work · Downtime', onPeek });
    showPageBlock(document, { message: 'again', detail: 'again', onPeek });
    expect(document.querySelectorAll(`#${OVERLAY_ID}`)).toHaveLength(1);
    const overlay = document.getElementById(OVERLAY_ID) as HTMLElement;
    expect(overlay.textContent).toContain('gh:acme-corp can wait.');
    expect(overlay.textContent).toContain('Work · Downtime');
    (overlay.querySelector('button') as HTMLButtonElement).click();
    expect(onPeek).toHaveBeenCalledTimes(1);
  });

  it('hides', () => {
    showPageBlock(document, { message: 'm', detail: 'd', onPeek: () => {} });
    hidePageBlock(document);
    expect(document.getElementById(OVERLAY_ID)).toBeNull();
  });
});

// When to re-check the page that owns this document.
//
// A navigation's destination URL must never be checked: the Navigation API "navigate" event
// (behind WXT's `wxt:locationchange`) fires before the URL commits, and also for navigations
// that never land in this document (full-load link clicks, cancelled or interrupted SPA
// navigations). Checking the destination would put the next page's overlay on the page being
// left, which can then be restored covered from the back/forward cache.
// So the signal is only a hint (the entrypoint prefers "currententrychange", which fires only
// after a same-document commit). The check runs in a later task against the committed
// `location.href`; for a navigation that didn't land here it re-checks the page we are still
// on, which is a no-op. Pages restored from the back/forward cache are re-checked too.

export interface NavigationSource {
  // Fires on (possible) SPA navigation. The event's newUrl is deliberately ignored.
  onLocationChange(handler: () => void): void;
  onPageShow(handler: (event: { persisted: boolean }) => void): void;
  // Runs fn in a later task.
  defer(fn: () => void): void;
  // The committed URL.
  href(): string;
}

export function watchNavigation(source: NavigationSource, check: (url: URL) => void): void {
  const checkCommitted = () => check(new URL(source.href()));
  source.onLocationChange(() => source.defer(checkCommitted));
  source.onPageShow((event) => {
    if (event.persisted) checkCommitted();
  });
}

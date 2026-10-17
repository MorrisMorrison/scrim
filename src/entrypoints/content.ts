import { runContent } from '../content/controller';
import { watchNavigation } from '../content/navigation';
import { adapterForHost, CONTENT_MATCHES } from '../sites';

export default defineContentScript({
  matches: CONTENT_MATCHES,
  runAt: 'document_start',
  main(ctx) {
    const adapter = adapterForHost(location.hostname);
    if (!adapter) return;
    // Page checks read the committed URL after a navigation; see content/navigation.ts.
    void runContent(adapter, (check) =>
      watchNavigation(
        {
          onLocationChange: (h) => {
            // "currententrychange" fires only once a same-document navigation has committed
            // (pushState, replaceState, intercepted, traversal). WXT's wxt:locationchange is
            // the fallback: it fires on "navigate" (before commit, also for navigations that
            // never land here) and dedupes on that uncommitted destination.
            if (typeof globalThis.navigation?.addEventListener === 'function') {
              navigation.addEventListener('currententrychange', () => h(), { signal: ctx.signal });
            } else {
              ctx.addEventListener(window, 'wxt:locationchange', () => h());
            }
          },
          onPageShow: (h) => ctx.addEventListener(window, 'pageshow', h),
          defer: (fn) => void ctx.setTimeout(fn, 0),
          href: () => location.href,
        },
        check,
      ),
    );
  },
});

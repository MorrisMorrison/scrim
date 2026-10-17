import { runContent } from '../content/controller';
import { adapterForHost, CONTENT_MATCHES } from '../sites';

export default defineContentScript({
  matches: CONTENT_MATCHES,
  runAt: 'document_start',
  main(ctx) {
    const adapter = adapterForHost(location.hostname);
    if (!adapter) return;
    // WXT fires this from the Navigation API's "navigate" event, before location.href
    // commits, so the new URL has to come from the event.
    void runContent(adapter, (cb) =>
      ctx.addEventListener(window, 'wxt:locationchange', (e) => cb(e.newUrl)),
    );
  },
});

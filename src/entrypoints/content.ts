import { runContent } from '../content/controller';
import { adapterForHost, CONTENT_MATCHES } from '../sites';

export default defineContentScript({
  matches: CONTENT_MATCHES,
  runAt: 'document_start',
  main(ctx) {
    const adapter = adapterForHost(location.hostname);
    if (!adapter) return;
    void runContent(adapter, (cb) => ctx.addEventListener(window, 'wxt:locationchange', cb));
  },
});

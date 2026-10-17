import { hostMatches, normalizeHost } from '../core/host';
import type { SourceRef } from '../core/model';
import { sourceKey } from '../core/sources';

// Labels that describe content: image alt-text, and aria-labels of links and media.
const LABELLED = 'img[alt], a[aria-label], img[aria-label], video[aria-label], svg[aria-label]';
// Controls carry site chrome, not content (X puts a "Grok actions" button on every tweet).
const CONTROL = 'button, [role="button"], [role^="menu"]';

const NON_TEXT = new Set(['SCRIPT', 'STYLE']);

// Text used for keyword matching. Includes alt-text and link/media aria-labels so image-only
// promoted posts (headline baked into the picture) are still caught.
// Walks text nodes instead of reading innerText: the pre-hide CSS sets visibility:hidden, under
// which Blink's innerText is "", and innerText forces a layout on every call.
export function richText(el: Element): string {
  const parts: string[] = [];
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeType === Node.ELEMENT_NODE && NON_TEXT.has((n as Element).tagName)
        ? NodeFilter.FILTER_REJECT // skips the whole subtree
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE && n.nodeValue) parts.push(n.nodeValue);
  }
  el.querySelectorAll(LABELLED).forEach((n) => {
    if (insideControl(n, el)) return;
    const label = n.getAttribute('alt') || n.getAttribute('aria-label');
    if (label) parts.push(label);
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// Whether n is a control, or inside one, within the item (the item itself doesn't count).
function insideControl(n: Element, item: Element): boolean {
  const control = n.closest(CONTROL);
  return control !== null && control !== item && item.contains(control);
}

export function dedupeSources(list: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = sourceKey(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// External link domains inside an item (same-site links are ignored).
export function linkDomains(el: Element): SourceRef[] {
  const doc = el.ownerDocument;
  const here = normalizeHost(doc.location?.hostname ?? '');
  const out: SourceRef[] = [];
  el.querySelectorAll('a[href]').forEach((a) => {
    try {
      const host = normalizeHost(new URL(a.getAttribute('href') ?? '', doc.baseURI).hostname);
      if (host && !hostMatches(host, here)) out.push({ kind: 'domain', host });
    } catch {
      // malformed href: ignore
    }
  });
  return dedupeSources(out);
}

import { hostMatches, normalizeHost } from '../core/host';
import type { SourceRef } from '../core/model';
import { sourceKey } from '../core/sources';

// Labels that describe content: image alt-text, and aria-labels of links and media.
const LABELLED = 'img[alt], a[aria-label], img[aria-label], video[aria-label], svg[aria-label]';
// Controls carry site chrome, not content (X puts a "Grok actions" button on every tweet).
const CONTROL = 'button, [role="button"], [role^="menu"]';

const NON_TEXT = new Set(['script', 'style']);
// Inline formatting: text on either side of these boundaries is one run ("Open<b>AI</b>" is
// "OpenAI"). Every other element boundary (blocks, cells, list items, <br>…) separates words.
const INLINE = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q',
  's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
]);

function collectText(node: Node, out: string[]): void {
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === Node.TEXT_NODE) {
      if (c.nodeValue) out.push(c.nodeValue);
    } else if (c.nodeType === Node.ELEMENT_NODE) {
      const tag = (c as Element).localName;
      if (NON_TEXT.has(tag)) continue;
      const inline = INLINE.has(tag);
      if (!inline) out.push(' ');
      collectText(c, out);
      if (!inline) out.push(' ');
    }
  }
}

// Text used for keyword matching. Includes alt-text and link/media aria-labels so image-only
// promoted posts (headline baked into the picture) are still caught.
// Walks text nodes instead of reading innerText: the pre-hide CSS sets visibility:hidden, under
// which Blink's innerText is "", and innerText forces a layout on every call.
export function richText(el: Element): string {
  const text: string[] = [];
  collectText(el, text);
  const parts = [text.join('')];
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

// Absolute web links ("https://…", "http://…") and protocol-relative ones ("//host/…"). Anything
// else (relative paths, "#…", "?…", mailto:, javascript:) can't point to another site, so it is
// never parsed — most links on Reddit and X are relative.
const WEB_LINK = /^(?:https?:)?\/\//i;

// External link domains inside an item (same-site links are ignored).
export function linkDomains(el: Element): SourceRef[] {
  const doc = el.ownerDocument;
  const here = normalizeHost(doc.location?.hostname ?? '');
  let base: string | undefined; // read once, and only if a protocol-relative link needs it
  const out: SourceRef[] = [];
  el.querySelectorAll('a[href]').forEach((a) => {
    const href = (a.getAttribute('href') ?? '').trim();
    if (!WEB_LINK.test(href)) return;
    try {
      const url = href.startsWith('//') ? new URL(href, (base ??= doc.baseURI)) : new URL(href);
      const host = normalizeHost(url.hostname);
      if (host && !hostMatches(host, here)) out.push({ kind: 'domain', host });
    } catch {
      // malformed href: ignore
    }
  });
  return dedupeSources(out);
}

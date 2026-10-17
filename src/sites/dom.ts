import { hostMatches, normalizeHost } from '../core/host';
import type { SourceRef } from '../core/model';
import { sourceKey } from '../core/sources';

// Labels that describe content: image alt-text, and aria-labels of links and media.
const LABELLED = 'img[alt], a[aria-label], img[aria-label], video[aria-label], svg[aria-label]';
// Controls carry site chrome, not content (X puts a "Grok actions" button on every tweet).
const CONTROL = 'button, [role="button"], [role^="menu"]';

// Text used for keyword matching. Includes alt-text and link/media aria-labels so image-only
// promoted posts (headline baked into the picture) are still caught.
export function richText(el: Element): string {
  const base = (el as HTMLElement).innerText || el.textContent || '';
  const extras: string[] = [];
  el.querySelectorAll(LABELLED).forEach((n) => {
    if (insideControl(n, el)) return;
    const label = n.getAttribute('alt') || n.getAttribute('aria-label');
    if (label) extras.push(label);
  });
  return [base, ...extras].join(' ').trim();
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

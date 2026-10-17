import { hostMatches, normalizeHost } from '../core/host';
import type { SourceRef } from '../core/model';
import { sourceKey } from '../core/sources';

// Text used for keyword matching. Includes image alt-text and aria-labels so image-only
// promoted posts (headline baked into the picture) are still caught.
export function richText(el: Element): string {
  const base = (el as HTMLElement).innerText || el.textContent || '';
  const extras: string[] = [];
  el.querySelectorAll('img[alt], [aria-label]').forEach((n) => {
    const label = n.getAttribute('alt') || n.getAttribute('aria-label');
    if (label) extras.push(label);
  });
  return [base, ...extras].join(' ').trim();
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

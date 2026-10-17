// Hostname helpers. A domain entry covers itself and all of its subdomains.

export function normalizeHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^\*\./, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

export function hostMatches(host: string, domain: string): boolean {
  const h = normalizeHost(host);
  const d = normalizeHost(domain);
  return d.length > 0 && (h === d || h.endsWith('.' + d));
}

// The URL, normalized, if it is a web page (http/https); null for anything else
// (javascript:, data:, chrome:, file:, garbage). Guards navigation to untrusted URLs.
export function webUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

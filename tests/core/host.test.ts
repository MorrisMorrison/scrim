import { describe, expect, it } from 'vitest';
import { hostMatches, normalizeHost, webUrl } from '../../src/core/host';

describe('normalizeHost', () => {
  it('strips scheme, path, port, www, wildcard and trailing dot, and lowercases', () => {
    expect(normalizeHost('https://WWW.Example.com/path?x=1')).toBe('example.com');
    expect(normalizeHost('*.foo.com')).toBe('foo.com');
    expect(normalizeHost('foo.com.')).toBe('foo.com');
    expect(normalizeHost('localhost:8080')).toBe('localhost');
    expect(normalizeHost('  Reddit.com ')).toBe('reddit.com');
  });
});

describe('hostMatches', () => {
  it('matches the domain itself and its subdomains', () => {
    expect(hostMatches('news.ycombinator.com', 'ycombinator.com')).toBe(true);
    expect(hostMatches('www.reddit.com', 'reddit.com')).toBe(true);
    expect(hostMatches('reddit.com', 'reddit.com')).toBe(true);
  });

  it('does not match parents or lookalikes', () => {
    expect(hostMatches('ycombinator.com', 'news.ycombinator.com')).toBe(false);
    expect(hostMatches('notycombinator.com', 'ycombinator.com')).toBe(false);
  });

  it('never matches an empty domain', () => {
    expect(hostMatches('reddit.com', '')).toBe(false);
  });
});

describe('webUrl', () => {
  it('accepts http(s) URLs only', () => {
    expect(webUrl('https://news.ycombinator.com/item?id=1#c')).toBe('https://news.ycombinator.com/item?id=1#c');
    expect(webUrl('http://example.org')).toBe('http://example.org/');
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'chrome://settings', 'file:///etc/passwd', '', 'nope']) {
      expect(webUrl(bad)).toBeNull();
    }
  });
});

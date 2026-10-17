import { describe, expect, it } from 'vitest';
import type { SourceRef } from '../../src/core/model';
import { formatSource, normalizeSource, parseSource, sourceKey } from '../../src/core/sources';

describe('parseSource', () => {
  it('parses every supported notation', () => {
    expect(parseSource('r/ChatGPT')).toEqual({ kind: 'subreddit', name: 'ChatGPT' });
    expect(parseSource('/r/ChatGPT/')).toEqual({ kind: 'subreddit', name: 'ChatGPT' });
    expect(parseSource('yt:@TwoMinutePapers')).toEqual({ kind: 'channel', handle: 'TwoMinutePapers' });
    expect(parseSource('x:@sama')).toEqual({ kind: 'x-user', handle: 'sama' });
    expect(parseSource('gh:acme-corp')).toEqual({ kind: 'github-owner', owner: 'acme-corp' });
    expect(parseSource('the-decoder.de')).toEqual({ kind: 'domain', host: 'the-decoder.de' });
    expect(parseSource('domain:Example.org')).toEqual({ kind: 'domain', host: 'example.org' });
  });

  it('rejects anything else', () => {
    expect(parseSource('hello')).toBeNull();
    expect(parseSource('r/')).toBeNull();
    expect(parseSource('')).toBeNull();
  });
});

describe('formatSource', () => {
  it('round-trips through parseSource', () => {
    const refs: SourceRef[] = [
      { kind: 'subreddit', name: 'ChatGPT' },
      { kind: 'channel', handle: 'someone' },
      { kind: 'x-user', handle: 'sama' },
      { kind: 'github-owner', owner: 'acme-corp' },
      { kind: 'domain', host: 'the-decoder.de' },
    ];
    for (const ref of refs) expect(parseSource(formatSource(ref))).toEqual(ref);
  });
});

describe('normalizeSource / sourceKey', () => {
  it('ignores case and prefixes', () => {
    expect(sourceKey({ kind: 'subreddit', name: 'r/ChatGPT' })).toBe(
      sourceKey({ kind: 'subreddit', name: 'chatgpt' }),
    );
    expect(sourceKey({ kind: 'channel', handle: '@Foo' })).toBe('channel:foo');
    expect(normalizeSource({ kind: 'domain', host: 'WWW.Example.com' })).toEqual({
      kind: 'domain',
      host: 'example.com',
    });
  });

  it('keeps kinds apart', () => {
    expect(sourceKey({ kind: 'channel', handle: 'x' })).not.toBe(
      sourceKey({ kind: 'x-user', handle: 'x' }),
    );
  });
});

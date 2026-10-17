import { describe, expect, it } from 'vitest';
import { BUILTIN_TOPICS, isBuiltinTopicId } from '../../src/core/defaults';
import type { Topic } from '../../src/core/model';
import {
  addEntry,
  applyOverride,
  emptyOverride,
  hasEntry,
  removeEntry,
  withList,
} from '../../src/core/topics';

const base: Topic = {
  id: 'ai',
  name: 'AI',
  keywords: ['AI', 'ChatGPT'],
  sources: [{ kind: 'subreddit', name: 'ChatGPT' }],
  blockSites: ['example.com'],
};

describe('defaults', () => {
  it('know their built-in ids', () => {
    expect(isBuiltinTopicId('ai')).toBe(true);
    expect(isBuiltinTopicId('nope')).toBe(false);
    expect(BUILTIN_TOPICS.work.keywords).toContain('LinkedIn');
    expect(BUILTIN_TOPICS.software.blockSites).toContain('news.ycombinator.com');
  });
});

describe('applyOverride', () => {
  it('returns the base lists when there is no override', () => {
    expect(applyOverride(base, undefined)).toEqual(base);
  });

  it('removes, then appends added entries, de-duplicated', () => {
    const ov = emptyOverride();
    ov.removed.keywords.push('ChatGPT');
    ov.added.keywords.push('Claude', 'AI');
    ov.added.blockSites.push('WWW.Example.com', 'other.org');
    ov.removed.sources.push({ kind: 'subreddit', name: 'r/chatgpt' });
    const t = applyOverride(base, ov);
    expect(t.keywords).toEqual(['AI', 'Claude']);
    expect(t.blockSites).toEqual(['example.com', 'other.org']);
    expect(t.sources).toEqual([]);
  });
});

describe('addEntry / removeEntry', () => {
  it('removing a shipped entry records it in removed', () => {
    const ov = removeEntry(base, emptyOverride(), 'keywords', 'ChatGPT');
    expect(ov.removed.keywords).toEqual(['ChatGPT']);
    expect(applyOverride(base, ov).keywords).toEqual(['AI']);
  });

  it('re-adding a removed shipped entry un-removes it instead of adding a copy', () => {
    const removed = removeEntry(base, emptyOverride(), 'keywords', 'ChatGPT');
    const ov = addEntry(base, removed, 'keywords', 'ChatGPT');
    expect(ov.removed.keywords).toEqual([]);
    expect(ov.added.keywords).toEqual([]);
  });

  it('removing a user-added entry drops it without recording a removal', () => {
    const added = addEntry(base, emptyOverride(), 'sources', { kind: 'channel', handle: 'foo' });
    const ov = removeEntry(base, added, 'sources', { kind: 'channel', handle: '@FOO' });
    expect(ov.added.sources).toEqual([]);
    expect(ov.removed.sources).toEqual([]);
  });

  it('adding an existing entry is a no-op', () => {
    const ov = addEntry(base, emptyOverride(), 'blockSites', 'www.example.com');
    expect(ov).toEqual(emptyOverride());
  });

  it('never mutates its inputs', () => {
    const ov = emptyOverride();
    addEntry(base, ov, 'keywords', 'Claude');
    removeEntry(base, ov, 'keywords', 'AI');
    expect(ov).toEqual(emptyOverride());
    expect(base.keywords).toEqual(['AI', 'ChatGPT']);
  });
});

describe('hasEntry / withList', () => {
  it('compare by normalised key', () => {
    expect(hasEntry('blockSites', base.blockSites, 'https://www.example.com/x')).toBe(true);
    expect(hasEntry('keywords', base.keywords, 'chatgpt')).toBe(false);
  });

  it('withList returns a copy with one list replaced', () => {
    const t = withList(base, 'keywords', ['x']);
    expect(t.keywords).toEqual(['x']);
    expect(base.keywords).toEqual(['AI', 'ChatGPT']);
  });
});

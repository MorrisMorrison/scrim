// Core pieces behind in-page feedback: which keyword entry matched, structured verdicts, the
// "Never hide" allowlist, picking an item's source, and editing topics/allowlist in storage.
import { describe, expect, it } from 'vitest';
import { compileKeywords, matchEntry } from '../../src/core/matcher';
import { menuItems, MENU_ALLOW, MENU_HIDE_PREFIX } from '../../src/core/menus';
import type { SourceRef, Topic } from '../../src/core/model';
import { buildPipeline } from '../../src/core/pipeline';
import { pickSource } from '../../src/core/sources';
import {
  addTopicEntry,
  allTopics,
  exportState,
  KEYS,
  loadState,
  parseExport,
  parseState,
  removeTopicEntry,
  replaceState,
  saveAllow,
  saveCustomTopic,
  seedIfEmpty,
} from '../../src/core/store';
import { memoryKV } from '../helpers/memory-kv';

const ai: Topic = {
  id: 'ai',
  name: 'AI',
  keywords: ['LLM', 'generative AI', '/gpt-?[0-9]/i'],
  sources: [{ kind: 'subreddit', name: 'ChatGPT' }],
  blockSites: [],
};

describe('matchEntry', () => {
  const c = compileKeywords(ai.keywords);
  it('reports the configured entry, not just the matched text', () => {
    expect(matchEntry('running LLMs locally', c)).toEqual({ text: 'LLMs', keyword: 'LLM' });
    expect(matchEntry('Generative AI is everywhere', c)).toEqual({
      text: 'Generative AI',
      keyword: 'generative AI',
    });
    expect(matchEntry('the GPT5 launch', c)).toEqual({ text: 'GPT5', keyword: '/gpt-?[0-9]/i' });
    expect(matchEntry('cats and dogs', c)).toBeNull();
  });
});

describe('structured verdicts', () => {
  const p = buildPipeline([ai]);
  it('say which keyword fired', () => {
    expect(p.evaluate({ text: 'an LLM post', sources: [] })?.match).toEqual({
      kind: 'keyword',
      keyword: 'LLM',
      text: 'LLM',
    });
  });
  it('say which item source fired', () => {
    expect(p.evaluate({ text: '', sources: [{ kind: 'subreddit', name: 'chatgpt' }] })?.match).toEqual({
      kind: 'source',
      source: { kind: 'subreddit', name: 'chatgpt' },
    });
  });
});

describe('Never hide allowlist', () => {
  const allow: SourceRef[] = [
    { kind: 'subreddit', name: 'LocalLLaMA' },
    { kind: 'domain', host: 'example.org' },
  ];
  const p = buildPipeline([ai], allow);
  it('wins over keywords and sources', () => {
    expect(p.evaluate({ text: 'an LLM post', sources: [{ kind: 'subreddit', name: 'localllama' }] })).toBeNull();
    expect(p.evaluate({ text: 'LLM', sources: [{ kind: 'domain', host: 'blog.example.org' }] })).toBeNull();
  });
  it('leaves other items alone', () => {
    expect(p.evaluate({ text: 'an LLM post', sources: [{ kind: 'subreddit', name: 'other' }] })?.topicId).toBe('ai');
  });
  it('an allowlist alone does not make an empty pipeline active', () => {
    expect(buildPipeline([], allow).empty).toBe(true);
  });
});

describe('pickSource', () => {
  it('prefers the most specific source', () => {
    const domain: SourceRef = { kind: 'domain', host: 'example.org' };
    const sub: SourceRef = { kind: 'subreddit', name: 'gardening' };
    const channel: SourceRef = { kind: 'channel', handle: 'someone' };
    expect(pickSource([domain, sub])).toEqual(sub);
    expect(pickSource([domain, channel])).toEqual(channel);
    expect(pickSource([domain])).toEqual(domain);
    expect(pickSource([])).toBeNull();
  });
});

describe('topic entry edits', () => {
  const src: SourceRef = { kind: 'subreddit', name: 'LinkedInLunatics' };

  it('add and remove on a built-in topic go through its override', async () => {
    const kv = memoryKV();
    await seedIfEmpty(kv);
    await addTopicEntry(kv, await loadState(kv), 'ai', 'sources', { kind: 'channel', handle: 'x' });
    let ai2 = allTopics(await loadState(kv)).find((t) => t.id === 'ai');
    expect(ai2?.sources).toContainEqual({ kind: 'channel', handle: 'x' });
    await removeTopicEntry(kv, await loadState(kv), 'ai', 'keywords', 'ChatGPT');
    ai2 = allTopics(await loadState(kv)).find((t) => t.id === 'ai');
    expect(ai2?.keywords).not.toContain('ChatGPT');
  });

  it('add and remove on a custom topic edit the topic itself', async () => {
    const kv = memoryKV();
    await saveCustomTopic(kv, { id: 'mine', name: 'Mine', keywords: ['x'], sources: [], blockSites: [] });
    await addTopicEntry(kv, await loadState(kv), 'mine', 'sources', src);
    expect((await loadState(kv)).customTopics[0]?.sources).toEqual([src]);
    await addTopicEntry(kv, await loadState(kv), 'mine', 'sources', { kind: 'subreddit', name: 'linkedinlunatics' });
    expect((await loadState(kv)).customTopics[0]?.sources).toHaveLength(1); // no duplicates
    await removeTopicEntry(kv, await loadState(kv), 'mine', 'sources', src);
    expect((await loadState(kv)).customTopics[0]?.sources).toEqual([]);
  });

  it('refuses an unknown topic', async () => {
    const kv = memoryKV();
    await expect(addTopicEntry(kv, await loadState(kv), 'nope', 'sources', src)).rejects.toThrow('Unknown topic');
  });
});

describe('allowlist storage', () => {
  it('round-trips and ignores malformed data', async () => {
    const kv = memoryKV();
    expect((await loadState(kv)).allow).toEqual([]);
    await saveAllow(kv, [{ kind: 'subreddit', name: 'gardening' }]);
    expect(kv.data[KEYS.allow]).toEqual([{ kind: 'subreddit', name: 'gardening' }]);
    expect((await loadState(kv)).allow).toEqual([{ kind: 'subreddit', name: 'gardening' }]);
    expect(parseState({ [KEYS.allow]: [{ kind: 'bogus' }] }).allow).toEqual([]);
  });

  it('is part of backups, and old backups without it still import', async () => {
    const kv = memoryKV();
    await seedIfEmpty(kv);
    await saveAllow(kv, [{ kind: 'domain', host: 'example.org' }]);
    const file = JSON.parse(JSON.stringify(exportState(await loadState(kv))));
    const parsed = parseExport(file);
    expect(typeof parsed !== 'string' && parsed.allow).toEqual([{ kind: 'domain', host: 'example.org' }]);
    delete file.allow;
    const old = parseExport(file);
    expect(typeof old !== 'string' && old.allow).toEqual([]);
    expect(parseExport({ ...file, allow: [{ kind: 'bogus' }] })).toBe('Invalid never-hide list');

    const kv2 = memoryKV();
    if (typeof parsed !== 'string') await replaceState(kv2, parsed);
    expect((await loadState(kv2)).allow).toEqual([{ kind: 'domain', host: 'example.org' }]);
  });
});

describe('context menu items', () => {
  it('offer one hide entry per topic plus "always show"', () => {
    const items = menuItems(allTopics(parseState({})));
    const hide = items.filter((i) => i.id.startsWith(MENU_HIDE_PREFIX));
    expect(hide.map((i) => i.title)).toContain('AI');
    expect(hide.every((i) => i.parentId === 'scrim-hide')).toBe(true);
    expect(items.some((i) => i.id === MENU_ALLOW)).toBe(true);
  });
});

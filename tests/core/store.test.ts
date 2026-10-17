import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILES } from '../../src/core/defaults';
import type { Profile, Topic } from '../../src/core/model';
import {
  activeProfile,
  activeTopics,
  allTopics,
  deleteCustomTopic,
  deleteProfile,
  exportState,
  filteringActive,
  isHostDisabled,
  KEYS,
  loadState,
  parseExport,
  parseState,
  replaceState,
  resetAll,
  saveCustomTopic,
  saveOverride,
  saveProfile,
  saveSettings,
  seedIfEmpty,
} from '../../src/core/store';
import { emptyOverride } from '../../src/core/topics';
import { memoryKV } from '../helpers/memory-kv';

const custom: Topic = { id: 'crypto', name: 'Crypto', keywords: ['bitcoin'], sources: [], blockSites: [] };

describe('seedIfEmpty', () => {
  it('writes defaults once', async () => {
    const kv = memoryKV();
    expect(await seedIfEmpty(kv)).toBe(true);
    expect(kv.data[KEYS.schemaVersion]).toBe(1);
    expect(kv.data[KEYS.profile('default')]).toEqual(DEFAULT_PROFILES[0]);
    expect(kv.data[KEYS.profile('downtime')]).toEqual(DEFAULT_PROFILES[1]);
    expect(await seedIfEmpty(kv)).toBe(false);
  });
});

describe('parseState', () => {
  it('falls back to defaults for an empty store', () => {
    const s = parseState({});
    expect(s.settings.activeProfileId).toBe('default');
    expect(s.profiles.map((p) => p.id)).toEqual(['default', 'downtime']);
    expect(s.customTopics).toEqual([]);
  });

  it('ignores malformed entries', () => {
    const s = parseState({
      settings: { enabled: 'yes' },
      'profile:x': { id: 'x' },
      'topic:y': { id: 'y', name: 'Y' },
      'topic-override:bogus': emptyOverride(),
    });
    expect(s.settings.enabled).toBe(true);
    expect(s.profiles.map((p) => p.id)).toEqual(['default', 'downtime']);
    expect(s.customTopics).toEqual([]);
    expect(s.overrides).toEqual({});
  });

  it('orders default profiles first, then the rest by name', () => {
    const mk = (id: string, name: string): Profile => ({ id, name, topics: [], action: 'hide', tweaks: {} });
    const s = parseState({
      'profile:z': mk('z', 'Zen'),
      'profile:downtime': mk('downtime', 'Downtime'),
      'profile:a': mk('a', 'Away'),
      'profile:default': mk('default', 'Default'),
    });
    expect(s.profiles.map((p) => p.id)).toEqual(['default', 'downtime', 'a', 'z']);
  });
});

describe('derived reads', () => {
  it('resolve the active profile and its topics with overrides applied', async () => {
    const kv = memoryKV();
    await seedIfEmpty(kv);
    const ov = emptyOverride();
    ov.added.keywords.push('Claude Code');
    await saveOverride(kv, 'ai', ov);
    await saveCustomTopic(kv, custom);
    const s = await loadState(kv);
    expect(activeProfile(s).id).toBe('default');
    expect(activeTopics(s).map((t) => t.id)).toEqual(['ai']);
    expect(activeTopics(s)[0]!.keywords).toContain('Claude Code');
    expect(allTopics(s).map((t) => t.id)).toEqual(['ai', 'software', 'work', 'politics', 'markets', 'hustle', 'ragebait', 'news', 'gossip', 'spoilers', 'nsfw', 'crypto']);
  });

  it('fall back to the first profile when the active id is unknown', () => {
    const s = parseState({ settings: { enabled: true, activeProfileId: 'gone', disabledSites: [] } });
    expect(activeProfile(s).id).toBe('default');
  });

  it('respect global and per-site switches', () => {
    const s = parseState({ settings: { enabled: true, activeProfileId: 'default', disabledSites: ['reddit.com'] } });
    expect(isHostDisabled(s, 'old.reddit.com')).toBe(true);
    expect(filteringActive(s, 'old.reddit.com')).toBe(false);
    expect(filteringActive(s, 'www.youtube.com')).toBe(true);
    s.settings.enabled = false;
    expect(filteringActive(s, 'www.youtube.com')).toBe(false);
  });
});

describe('writes', () => {
  it('deleteProfile refuses to delete the last profile', async () => {
    const kv = memoryKV();
    await saveProfile(kv, { id: 'only', name: 'Only', topics: [], action: 'hide', tweaks: {} });
    const s = await loadState(kv);
    await expect(deleteProfile(kv, s, 'only')).rejects.toThrow('At least one profile');
  });

  it('deleteProfile switches away from a deleted active profile', async () => {
    const kv = memoryKV();
    await seedIfEmpty(kv);
    await saveSettings(kv, { enabled: true, activeProfileId: 'downtime', disabledSites: [] });
    await deleteProfile(kv, await loadState(kv), 'downtime');
    const s = await loadState(kv);
    expect(s.profiles.map((p) => p.id)).toEqual(['default']);
    expect(s.settings.activeProfileId).toBe('default');
  });

  it('deleteCustomTopic also removes it from every profile', async () => {
    const kv = memoryKV();
    await seedIfEmpty(kv);
    await saveCustomTopic(kv, custom);
    const p = (await loadState(kv)).profiles[0]!;
    await saveProfile(kv, { ...p, topics: [...p.topics, 'crypto'] });
    await deleteCustomTopic(kv, await loadState(kv), 'crypto');
    const s = await loadState(kv);
    expect(s.customTopics).toEqual([]);
    expect(s.profiles[0]!.topics).toEqual(['ai']);
  });
});

describe('export / import', () => {
  it('round-trips', async () => {
    const kv = memoryKV();
    await seedIfEmpty(kv);
    await saveCustomTopic(kv, custom);
    const before = await loadState(kv);
    const file = JSON.parse(JSON.stringify(exportState(before, new Date('2026-10-17T00:00:00Z'))));
    expect(file.format).toBe('scrim-export');
    expect(file.exportedAt).toBe('2026-10-17T00:00:00.000Z');
    expect(parseExport(file)).toEqual(before);
  });

  it('explains what is wrong with a bad file', () => {
    expect(parseExport(null)).toBe('Not a JSON object');
    expect(parseExport({ format: 'other' })).toBe('Not a Scrim export file');
    expect(parseExport({ format: 'scrim-export', schemaVersion: 99 })).toBe('Unsupported schema version: 99');
    const base = exportState(parseState({}));
    expect(parseExport({ ...base, profiles: [] })).toBe('Invalid profiles');
    expect(parseExport({ ...base, overrides: { bogus: emptyOverride() } })).toBe(
      'Invalid override for topic "bogus"',
    );
  });

  it('repairs a dangling active profile id on import', () => {
    const base = exportState(parseState({}));
    const parsed = parseExport({ ...base, settings: { ...base.settings, activeProfileId: 'gone' } });
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed !== 'string') expect(parsed.settings.activeProfileId).toBe('default');
  });

  it('replaceState removes keys that are not in the new state', async () => {
    const kv = memoryKV({ unrelated: 1 });
    await seedIfEmpty(kv);
    await saveCustomTopic(kv, custom);
    await replaceState(kv, parseState({}));
    expect(kv.data[KEYS.topic('crypto')]).toBeUndefined();
    expect(kv.data[KEYS.profile('default')]).toBeDefined();
    expect(kv.data.unrelated).toBe(1);
  });

  it('resetAll restores seeded defaults', async () => {
    const kv = memoryKV();
    await seedIfEmpty(kv);
    await saveCustomTopic(kv, custom);
    await resetAll(kv);
    const s = await loadState(kv);
    expect(s.customTopics).toEqual([]);
    expect(kv.data[KEYS.schemaVersion]).toBe(1);
  });
});

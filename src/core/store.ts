// Persistence over a tiny KV interface (browser.storage.local in the extension, an
// in-memory map in tests). One key per entity keeps each value small.
import {
  BUILTIN_TOPIC_IDS,
  BUILTIN_TOPICS,
  DEFAULT_PROFILES,
  DEFAULT_SETTINGS,
  isBuiltinTopicId,
} from './defaults';
import { hostMatches } from './host';
import type { BuiltinTopicId, BuiltinTopicOverride, GlobalSettings, Profile, Topic } from './model';
import { applyOverride } from './topics';
import { isOverride, isProfile, isSettings, isTopic } from './validate';

export interface KV {
  getAll(): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export const SCHEMA_VERSION = 1;

export const KEYS = {
  settings: 'settings',
  schemaVersion: 'schemaVersion',
  profile: (id: string) => `profile:${id}`,
  topic: (id: string) => `topic:${id}`,
  override: (id: BuiltinTopicId) => `topic-override:${id}`,
} as const;

const PROFILE_PREFIX = 'profile:';
const TOPIC_PREFIX = 'topic:';
const OVERRIDE_PREFIX = 'topic-override:';

function isScrimKey(key: string): boolean {
  return (
    key === KEYS.settings ||
    key === KEYS.schemaVersion ||
    key.startsWith(PROFILE_PREFIX) ||
    key.startsWith(TOPIC_PREFIX) ||
    key.startsWith(OVERRIDE_PREFIX)
  );
}

export interface ScrimState {
  settings: GlobalSettings;
  profiles: Profile[];
  customTopics: Topic[];
  overrides: Partial<Record<BuiltinTopicId, BuiltinTopicOverride>>;
}

function defaultProfiles(): Profile[] {
  return DEFAULT_PROFILES.map((p) => structuredClone(p));
}

function sortProfiles(list: Profile[]): Profile[] {
  const rank = (p: Profile) => {
    const i = DEFAULT_PROFILES.findIndex((d) => d.id === p.id);
    return i === -1 ? DEFAULT_PROFILES.length : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function parseState(raw: Record<string, unknown>): ScrimState {
  const rawSettings = raw[KEYS.settings];
  const settings: GlobalSettings = isSettings(rawSettings)
    ? rawSettings
    : structuredClone(DEFAULT_SETTINGS);
  const profiles: Profile[] = [];
  const customTopics: Topic[] = [];
  const overrides: ScrimState['overrides'] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(PROFILE_PREFIX) && isProfile(value)) {
      profiles.push(value);
    } else if (key.startsWith(OVERRIDE_PREFIX)) {
      const id = key.slice(OVERRIDE_PREFIX.length);
      if (isBuiltinTopicId(id) && isOverride(value)) overrides[id] = value;
    } else if (key.startsWith(TOPIC_PREFIX) && isTopic(value) && !isBuiltinTopicId(value.id)) {
      customTopics.push(value);
    }
  }
  return {
    settings,
    profiles: sortProfiles(profiles.length ? profiles : defaultProfiles()),
    customTopics: customTopics.sort((a, b) => a.name.localeCompare(b.name)),
    overrides,
  };
}

export async function loadState(kv: KV): Promise<ScrimState> {
  return parseState(await kv.getAll());
}

function seedItems(): Record<string, unknown> {
  const items: Record<string, unknown> = {
    [KEYS.schemaVersion]: SCHEMA_VERSION,
    [KEYS.settings]: structuredClone(DEFAULT_SETTINGS),
  };
  for (const p of DEFAULT_PROFILES) items[KEYS.profile(p.id)] = structuredClone(p);
  return items;
}

export async function seedIfEmpty(kv: KV): Promise<boolean> {
  const raw = await kv.getAll();
  if (raw[KEYS.schemaVersion] !== undefined) return false;
  await kv.set(seedItems());
  return true;
}

export function allTopics(state: ScrimState): Topic[] {
  return [
    ...BUILTIN_TOPIC_IDS.map((id) => applyOverride(BUILTIN_TOPICS[id], state.overrides[id])),
    ...state.customTopics,
  ];
}

export function findTopic(state: ScrimState, id: string): Topic | undefined {
  return allTopics(state).find((t) => t.id === id);
}

export function activeProfile(state: ScrimState): Profile {
  // parseState always yields at least one profile, so the fallback index is present.
  return state.profiles.find((p) => p.id === state.settings.activeProfileId) ?? state.profiles[0]!;
}

export function activeTopics(state: ScrimState): Topic[] {
  const byId = new Map(allTopics(state).map((t) => [t.id, t]));
  return activeProfile(state).topics.flatMap((id) => {
    const t = byId.get(id);
    return t ? [t] : [];
  });
}

export function isHostDisabled(state: ScrimState, host: string): boolean {
  return state.settings.disabledSites.some((d) => hostMatches(host, d));
}

export function filteringActive(state: ScrimState, host: string): boolean {
  return state.settings.enabled && !isHostDisabled(state, host);
}

export async function saveSettings(kv: KV, settings: GlobalSettings): Promise<void> {
  await kv.set({ [KEYS.settings]: settings });
}

export async function saveProfile(kv: KV, profile: Profile): Promise<void> {
  await kv.set({ [KEYS.profile(profile.id)]: profile });
}

export async function deleteProfile(kv: KV, state: ScrimState, id: string): Promise<void> {
  const remaining = state.profiles.filter((p) => p.id !== id);
  const fallback = remaining[0];
  if (fallback === undefined) throw new Error('At least one profile must exist');
  await kv.remove([KEYS.profile(id)]);
  if (state.settings.activeProfileId === id) {
    await saveSettings(kv, { ...state.settings, activeProfileId: fallback.id });
  }
}

export async function saveCustomTopic(kv: KV, topic: Topic): Promise<void> {
  await kv.set({ [KEYS.topic(topic.id)]: topic });
}

export async function deleteCustomTopic(kv: KV, state: ScrimState, id: string): Promise<void> {
  const items: Record<string, unknown> = {};
  for (const p of state.profiles) {
    if (p.topics.includes(id)) {
      items[KEYS.profile(p.id)] = { ...p, topics: p.topics.filter((t) => t !== id) };
    }
  }
  if (Object.keys(items).length) await kv.set(items);
  await kv.remove([KEYS.topic(id)]);
}

export async function saveOverride(
  kv: KV,
  id: BuiltinTopicId,
  ov: BuiltinTopicOverride,
): Promise<void> {
  await kv.set({ [KEYS.override(id)]: ov });
}

export interface ExportFile extends ScrimState {
  format: 'scrim-export';
  schemaVersion: number;
  exportedAt: string;
}

export function exportState(state: ScrimState, now: Date = new Date()): ExportFile {
  return {
    format: 'scrim-export',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...structuredClone(state),
  };
}

export function parseExport(data: unknown): ScrimState | string {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return 'Not a JSON object';
  const d = data as Record<string, unknown>;
  if (d.format !== 'scrim-export') return 'Not a Scrim export file';
  if (d.schemaVersion !== SCHEMA_VERSION) return `Unsupported schema version: ${String(d.schemaVersion)}`;
  const settings = d.settings;
  if (!isSettings(settings)) return 'Invalid settings';
  const profiles = d.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0 || !profiles.every(isProfile)) {
    return 'Invalid profiles';
  }
  const customTopics = d.customTopics;
  if (!Array.isArray(customTopics) || !customTopics.every(isTopic)) return 'Invalid custom topics';
  if (typeof d.overrides !== 'object' || d.overrides === null) return 'Invalid overrides';
  const overrides: ScrimState['overrides'] = {};
  for (const [id, ov] of Object.entries(d.overrides)) {
    if (!isBuiltinTopicId(id) || !isOverride(ov)) return `Invalid override for topic "${id}"`;
    overrides[id] = ov;
  }
  const activeProfileId = profiles.some((p) => p.id === settings.activeProfileId)
    ? settings.activeProfileId
    : profiles[0]!.id;
  return {
    settings: { ...settings, activeProfileId },
    profiles: sortProfiles(profiles),
    customTopics: [...customTopics].sort((a, b) => a.name.localeCompare(b.name)),
    overrides,
  };
}

async function clearAll(kv: KV): Promise<void> {
  const keys = Object.keys(await kv.getAll()).filter(isScrimKey);
  if (keys.length) await kv.remove(keys);
}

export async function replaceState(kv: KV, state: ScrimState): Promise<void> {
  await clearAll(kv);
  const items: Record<string, unknown> = {
    [KEYS.schemaVersion]: SCHEMA_VERSION,
    [KEYS.settings]: state.settings,
  };
  for (const p of state.profiles) items[KEYS.profile(p.id)] = p;
  for (const t of state.customTopics) items[KEYS.topic(t.id)] = t;
  for (const id of BUILTIN_TOPIC_IDS) {
    const ov = state.overrides[id];
    if (ov) items[KEYS.override(id)] = ov;
  }
  await kv.set(items);
}

export async function resetAll(kv: KV): Promise<void> {
  await clearAll(kv);
  await kv.set(seedItems());
}

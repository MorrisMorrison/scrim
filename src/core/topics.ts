// Built-in topics are stored as deltas so shipped list updates still reach users.
// Effective list = shipped − removed + added (de-duplicated by normalised key).
import { normalizeHost } from './host';
import type { BuiltinTopicOverride, SourceRef, Topic, TopicLists } from './model';
import { sourceKey } from './sources';

export type ListField = keyof TopicLists;
export type AnyEntry = string | SourceRef;

export function emptyLists(): TopicLists {
  return { keywords: [], sources: [], blockSites: [] };
}

export function emptyOverride(): BuiltinTopicOverride {
  return { added: emptyLists(), removed: emptyLists() };
}

export function entryKey(field: ListField, value: AnyEntry): string {
  if (field === 'sources') return sourceKey(value as SourceRef);
  if (field === 'blockSites') return normalizeHost(value as string);
  return (value as string).trim();
}

function list(lists: TopicLists, field: ListField): AnyEntry[] {
  return lists[field] as AnyEntry[];
}

function setList(lists: TopicLists, field: ListField, items: AnyEntry[]): void {
  (lists as Record<ListField, AnyEntry[]>)[field] = items;
}

export function hasEntry(field: ListField, items: readonly AnyEntry[], value: AnyEntry): boolean {
  const k = entryKey(field, value);
  return items.some((v) => entryKey(field, v) === k);
}

function without(field: ListField, items: readonly AnyEntry[], value: AnyEntry): AnyEntry[] {
  const k = entryKey(field, value);
  return items.filter((v) => entryKey(field, v) !== k);
}

function merge(
  field: ListField,
  base: readonly AnyEntry[],
  added: readonly AnyEntry[],
  removed: readonly AnyEntry[],
): AnyEntry[] {
  const drop = new Set(removed.map((v) => entryKey(field, v)));
  const seen = new Set<string>();
  const out: AnyEntry[] = [];
  for (const v of [...base, ...added]) {
    const k = entryKey(field, v);
    if (drop.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

export function applyOverride(base: Topic, ov: BuiltinTopicOverride | undefined): Topic {
  const out = structuredClone(base);
  if (!ov) return out;
  for (const field of ['keywords', 'sources', 'blockSites'] as const) {
    setList(out, field, merge(field, list(base, field), list(ov.added, field), list(ov.removed, field)));
  }
  return out;
}

export function addEntry(
  base: Topic,
  ov: BuiltinTopicOverride,
  field: ListField,
  value: AnyEntry,
): BuiltinTopicOverride {
  const next = structuredClone(ov);
  setList(next.removed, field, without(field, list(next.removed, field), value));
  if (!hasEntry(field, list(base, field), value) && !hasEntry(field, list(next.added, field), value)) {
    setList(next.added, field, [...list(next.added, field), value]);
  }
  return next;
}

export function removeEntry(
  base: Topic,
  ov: BuiltinTopicOverride,
  field: ListField,
  value: AnyEntry,
): BuiltinTopicOverride {
  const next = structuredClone(ov);
  setList(next.added, field, without(field, list(next.added, field), value));
  if (hasEntry(field, list(base, field), value) && !hasEntry(field, list(next.removed, field), value)) {
    setList(next.removed, field, [...list(next.removed, field), value]);
  }
  return next;
}

export function withList(topic: Topic, field: ListField, items: AnyEntry[]): Topic {
  const next = structuredClone(topic);
  setList(next, field, items);
  return next;
}

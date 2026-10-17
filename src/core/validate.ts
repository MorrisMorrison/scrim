// Runtime type guards for anything read from storage or an import file.
import type { BuiltinTopicOverride, GlobalSettings, Profile, SourceRef, Topic, TopicLists } from './model';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStrArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

export function isSourceRef(v: unknown): v is SourceRef {
  if (!isObj(v)) return false;
  switch (v.kind) {
    case 'subreddit':
      return typeof v.name === 'string';
    case 'channel':
    case 'x-user':
      return typeof v.handle === 'string';
    case 'domain':
      return typeof v.host === 'string';
    case 'github-owner':
      return typeof v.owner === 'string';
    default:
      return false;
  }
}

export function isTopicLists(v: unknown): v is TopicLists {
  return (
    isObj(v) &&
    isStrArr(v.keywords) &&
    Array.isArray(v.sources) &&
    v.sources.every(isSourceRef) &&
    isStrArr(v.blockSites)
  );
}

export function isTopic(v: unknown): v is Topic {
  return isObj(v) && typeof v.id === 'string' && typeof v.name === 'string' && isTopicLists(v);
}

export function isOverride(v: unknown): v is BuiltinTopicOverride {
  return isObj(v) && isTopicLists(v.added) && isTopicLists(v.removed);
}

export function isProfile(v: unknown): v is Profile {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    isStrArr(v.topics) &&
    (v.action === 'hide' || v.action === 'blur' || v.action === 'collapse') &&
    isObj(v.tweaks) &&
    Object.values(v.tweaks).every((x) => typeof x === 'boolean')
  );
}

export function isSettings(v: unknown): v is GlobalSettings {
  return (
    isObj(v) &&
    typeof v.enabled === 'boolean' &&
    typeof v.activeProfileId === 'string' &&
    isStrArr(v.disabledSites)
  );
}

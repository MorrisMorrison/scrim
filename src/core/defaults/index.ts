import type { BuiltinTopicId, GlobalSettings, Profile, Topic } from '../model';
import { AI_KEYWORDS } from './ai';
import { NSFW_KEYWORDS } from './nsfw';
import { SOFTWARE_KEYWORDS } from './software';

export const BUILTIN_TOPIC_IDS: readonly BuiltinTopicId[] = ['ai', 'software', 'work', 'nsfw'];

export const BUILTIN_TOPICS: Readonly<Record<BuiltinTopicId, Topic>> = {
  ai: { id: 'ai', name: 'AI', keywords: AI_KEYWORDS, sources: [], blockSites: [] },
  software: {
    id: 'software',
    name: 'Software/IT',
    keywords: SOFTWARE_KEYWORDS,
    sources: [],
    blockSites: ['news.ycombinator.com'],
  },
  // Ships empty on purpose: the repo is public, so work orgs/domains only ever live
  // in the user's browser storage or exported JSON.
  work: { id: 'work', name: 'Work', keywords: [], sources: [], blockSites: [] },
  nsfw: { id: 'nsfw', name: 'NSFW', keywords: NSFW_KEYWORDS, sources: [], blockSites: [] },
};

export function isBuiltinTopicId(id: string): id is BuiltinTopicId {
  return (BUILTIN_TOPIC_IDS as readonly string[]).includes(id);
}

// Seeded on first install; after that profiles are fully user-owned.
export const DEFAULT_PROFILES: readonly Profile[] = [
  {
    id: 'default',
    name: 'Default',
    topics: ['ai'],
    action: 'hide',
    tweaks: { 'google.hideAiOverview': true },
  },
  {
    id: 'downtime',
    name: 'Downtime',
    topics: ['ai', 'work', 'software'],
    action: 'hide',
    tweaks: {
      'google.hideAiOverview': true,
      'youtube.hideShorts': true,
      'youtube.hideHomeRecommendations': true,
      'youtube.hideWatchRecommendations': true,
    },
  },
];

export const DEFAULT_SETTINGS: GlobalSettings = {
  enabled: true,
  activeProfileId: 'default',
  disabledSites: [],
};

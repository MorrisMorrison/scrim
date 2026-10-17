import type { BuiltinTopicId, GlobalSettings, Profile, Topic } from '../model';
import { AI_KEYWORDS, AI_SOURCES } from './ai';
import { HUSTLE_KEYWORDS, HUSTLE_SOURCES } from './hustle';
import { MARKETS_KEYWORDS, MARKETS_SOURCES } from './markets';
import { NSFW_KEYWORDS } from './nsfw';
import { POLITICS_KEYWORDS, POLITICS_SOURCES } from './politics';
import { RAGEBAIT_KEYWORDS, RAGEBAIT_SOURCES } from './ragebait';
import { SOFTWARE_KEYWORDS, SOFTWARE_SOURCES } from './software';
import { WORK_KEYWORDS, WORK_SOURCES } from './work';

export const BUILTIN_TOPIC_IDS: readonly BuiltinTopicId[] = [
  'ai',
  'software',
  'work',
  'politics',
  'markets',
  'hustle',
  'ragebait',
  'nsfw',
];

export const BUILTIN_TOPICS: Readonly<Record<BuiltinTopicId, Topic>> = {
  ai: { id: 'ai', name: 'AI', keywords: AI_KEYWORDS, sources: AI_SOURCES, blockSites: [] },
  software: {
    id: 'software',
    name: 'Software/IT',
    keywords: SOFTWARE_KEYWORDS,
    sources: SOFTWARE_SOURCES,
    blockSites: ['news.ycombinator.com'],
  },
  // Generic job/career terms only. Personal work orgs and domains never ship here: they
  // live in the user's browser storage or exported (private) config.
  work: { id: 'work', name: 'Work', keywords: WORK_KEYWORDS, sources: WORK_SOURCES, blockSites: [] },
  politics: {
    id: 'politics',
    name: 'Politics',
    keywords: POLITICS_KEYWORDS,
    sources: POLITICS_SOURCES,
    blockSites: [],
  },
  markets: {
    id: 'markets',
    name: 'Crypto & markets',
    keywords: MARKETS_KEYWORDS,
    sources: MARKETS_SOURCES,
    blockSites: [],
  },
  hustle: {
    id: 'hustle',
    name: 'Hustle & self-improvement',
    keywords: HUSTLE_KEYWORDS,
    sources: HUSTLE_SOURCES,
    blockSites: [],
  },
  ragebait: {
    id: 'ragebait',
    name: 'Ragebait & clickbait',
    keywords: RAGEBAIT_KEYWORDS,
    sources: RAGEBAIT_SOURCES,
    blockSites: [],
  },
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

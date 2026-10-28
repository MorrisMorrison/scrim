// Domain types shared by every layer. Pure data: no DOM, no browser APIs.

export type SourceRef =
  | { kind: 'subreddit'; name: string }
  | { kind: 'channel'; handle: string }
  | { kind: 'x-user'; handle: string }
  | { kind: 'domain'; host: string }
  | { kind: 'github-owner'; owner: string };

export type SourceKind = SourceRef['kind'];

export interface TopicLists {
  keywords: string[];
  sources: SourceRef[];
  blockSites: string[];
}

export interface Topic extends TopicLists {
  id: string;
  name: string;
}

export type BuiltinTopicId = 'ai' | 'software' | 'work' | 'politics' | 'markets' | 'hustle' | 'ragebait' | 'news' | 'gossip' | 'spoilers' | 'nsfw';

export type Action = 'hide' | 'blur' | 'collapse';

export interface Profile {
  id: string;
  name: string;
  topics: string[];
  action: Action;
  tweaks: Record<string, boolean>;
}

export interface GlobalSettings {
  enabled: boolean;
  activeProfileId: string;
  disabledSites: string[];
}

// Built-in topics ship in code; storage only holds what the user changed.
export interface BuiltinTopicOverride {
  added: TopicLists;
  removed: TopicLists;
}

export interface ItemFacts {
  text: string;
  sources: SourceRef[];
}

// What made an item match, so feedback can undo exactly that ("stop hiding keyword X",
// "always show this source").
export type VerdictMatch =
  | { kind: 'keyword'; keyword: string; text: string }
  | { kind: 'source'; source: SourceRef };

export interface Verdict {
  topicId: string;
  reason: string;
  match: VerdictMatch;
}

export interface Stage {
  id: string;
  evaluate(facts: ItemFacts): Verdict | null;
}

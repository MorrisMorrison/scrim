import type { SourceRef } from '../model';

export function subreddits(...names: string[]): SourceRef[] {
  return names.map((name) => ({ kind: 'subreddit', name }));
}

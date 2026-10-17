import type { SourceRef } from '../model';
import { subreddits } from './sources';

// Patterns rather than subjects. Shouting caps are matched case-sensitively, so ordinary
// sentences ("a shocking amount of rain", "the storm destroyed the barn") stay visible.
export const RAGEBAIT_KEYWORDS: string[] = [
  "you won't believe",
  'what happened next',
  'breaks the internet',
  'goes viral',
  'nobody is talking about',
  'unpopular opinion',
  'hot take',
  'rage bait',
  'ragebait',
  'cancel culture',
  '/\\b(SHOCKING|INSANE|UNBELIEVABLE|EXPOSED|MELTDOWN)\\b/',
  '/\\b(DESTROYS|DESTROYED|OBLITERATES|SLAMS|OWNS|HUMILIATES)\\b/',
  'eviscerates',
  // German
  'rastet',
  'Eklat',
  'Shitstorm',
  'zerlegt',
];

export const RAGEBAIT_SOURCES: SourceRef[] = subreddits(
  'PublicFreakout',
  'ActualPublicFreakouts',
  'iamatotalpieceofshit',
  'insanepeoplefacebook',
  'facepalm',
  'clevercomebacks',
);

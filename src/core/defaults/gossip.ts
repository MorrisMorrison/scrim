import type { SourceRef } from '../model';
import { subreddits } from './sources';

// Celebrity, reality-TV and influencer gossip. Mostly caught by source; the keywords are the
// unambiguous ones ("tea", "drama", "star" alone are left out).
export const GOSSIP_KEYWORDS: string[] = [
  'celebrity',
  'celebrities',
  'red carpet',
  'Met Gala',
  'paparazzi',
  'reality TV',
  'Love Island',
  'Kardashian',
  'Taylor Swift',
  'Kanye',
  'influencer drama',
  'spilling the tea',
  'dating rumors',
  'dating rumours',
  'TMZ',
  // German
  'Promi',
  'Promis',
  'Dschungelcamp',
  'Klatsch',
];

export const GOSSIP_SOURCES: SourceRef[] = subreddits(
  'Fauxmoi',
  'Deuxmoi',
  'popculturechat',
  'KUWTK',
  'BravoRealHousewives',
  'LoveIslandTV',
  'InfluencerSnark',
  'celebrities',
);

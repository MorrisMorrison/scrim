import type { SourceRef } from '../model';
import { subreddits } from './sources';

// Hustle culture and self-optimisation content. Formulaic phrases only: "coach", "routine" and
// "mindset" alone are left out.
export const HUSTLE_KEYWORDS: string[] = [
  'side hustle',
  'hustle culture',
  'passive income',
  'grindset',
  'sigma male',
  'alpha male',
  'high-value man',
  'financial freedom',
  'make money online',
  'dropshipping',
  'solopreneur',
  'build in public',
  'personal brand',
  'productivity hack',
  'morning routine',
  'dopamine detox',
  'millionaire mindset',
  'life coach',
  'mindset coach',
  'self-improvement',
  'self improvement',
  'monk mode',
  // German
  'passives Einkommen',
  'Nebeneinkommen',
  'Selbstoptimierung',
];

export const HUSTLE_SOURCES: SourceRef[] = subreddits(
  'sidehustle',
  'passive_income',
  'Entrepreneur',
  'EntrepreneurRideAlong',
  'selfimprovement',
  'getdisciplined',
  'productivity',
  'GetMotivated',
);

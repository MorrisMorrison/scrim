import type { SourceRef } from '../model';
import { subreddits } from './sources';

// Doomscroll news: war, attacks, disasters. Harsh by nature, so it ships turned off.
// Bare "war", "shooting", "flood" and "attack" are left out (Star Wars, basketball, "a flood of ideas").
export const NEWS_KEYWORDS: string[] = [
  'war crimes',
  'invasion',
  'airstrike',
  'air strike',
  'missile strike',
  'drone strike',
  'shelling',
  'frontline',
  'ceasefire',
  'death toll',
  'massacre',
  'genocide',
  'mass shooting',
  'terror attack',
  'terrorist',
  'hostage',
  'bombing',
  'earthquake',
  'hurricane',
  'wildfire',
  'tsunami',
  'plane crash',
  'pandemic',
  // German
  'Krieg',
  'Kämpfe',
  'Anschlag',
  'Terroranschlag',
  'Todesopfer',
  'Geiseln',
  'Amoklauf',
  'Erdbeben',
  'Überschwemmung',
  'Waffenruhe',
];

export const NEWS_SOURCES: SourceRef[] = subreddits(
  'worldnews',
  'news',
  'UkraineWarVideoReport',
  'UkrainianConflict',
  'CombatFootage',
  'IsraelPalestine',
  'collapse',
);

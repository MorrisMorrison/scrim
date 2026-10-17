import type { SourceRef } from '../model';
import { subreddits } from './sources';

// Generic job/career/office terms only. Personal work orgs and domains never ship here;
// they live in the user's own storage or private exported config.
// Left out on purpose: "resume" (resume playback), "office", "burnout", "meeting".
export const WORK_KEYWORDS: string[] = [
  'LinkedIn',
  'layoff',
  'laid off',
  'job interview',
  'job hunt',
  'job search',
  'job market',
  'job offer',
  'recruiter',
  'hiring manager',
  'salary negotiation',
  'performance review',
  'promotion cycle',
  'return to office',
  'RTO',
  'corporate ladder',
  'middle management',
  'work-life balance',
  'toxic workplace',
  'quiet quitting',
  'OKR',
  'KPI',
  // German
  'Bewerbung',
  'Bewerbungsgespräch',
  'Vorstellungsgespräch',
  'Gehaltsverhandlung',
  'Gehaltserhöhung',
  'Arbeitgeber',
  'Arbeitnehmer',
  'Kündigung',
  'Homeoffice',
];

export const WORK_SOURCES: SourceRef[] = subreddits(
  'LinkedInLunatics',
  'antiwork',
  'recruitinghell',
  'jobs',
  'careerguidance',
  'overemployed',
  'managers',
  'humanresources',
  'WorkReform',
);

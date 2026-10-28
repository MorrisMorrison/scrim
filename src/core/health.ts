// Site health: turns the engine's counters into a verdict the popup can show. Sites change their
// markup without warning; this is how a broken adapter shows up the same day instead of as
// "things stopped being filtered".

export interface HealthStats {
  // Items that reached a final state (hit or pass); nested duplicates aren't counted.
  found: number;
  // Items that failed open because extracting them threw.
  errors: number;
  // Items shown only because they never got any text (the pending failsafe).
  empty: number;
}

export interface HealthInput {
  site: string; // adapter label, e.g. "Reddit"
  active: boolean; // filtering is on for this page (some topics active, site not disabled)
  expectsItems: boolean; // this page is a feed the adapter should find items on
  elapsedMs: number; // time since the content script started
  stats: HealthStats;
}

export type HealthStatus = 'ok' | 'warn' | 'idle';

export interface Health {
  status: HealthStatus;
  message: string;
}

// Feeds hydrate late; give a page this long before calling "no items" a problem.
export const NO_ITEMS_AFTER_MS = 5000;
const ERROR_RATIO = 0.2;
const MIN_ERRORS = 2;
const EMPTY_RATIO = 0.5;
const MIN_ITEMS_FOR_EMPTY = 4;

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

export function assessHealth({ site, active, expectsItems, elapsedMs, stats }: HealthInput): Health {
  if (!active) return { status: 'idle', message: 'Nothing to filter on this page.' };
  const { found, errors, empty } = stats;

  if (found === 0) {
    if (!expectsItems) return { status: 'idle', message: 'No feed on this page.' };
    if (elapsedMs < NO_ITEMS_AFTER_MS) return { status: 'ok', message: 'Looking for items…' };
    return {
      status: 'warn',
      message: `Scrim found no feed items on this page. ${site} may have changed its layout.`,
    };
  }
  if (errors >= MIN_ERRORS && errors / found > ERROR_RATIO) {
    return {
      status: 'warn',
      message: `${errors} of ${found} items couldn't be read and were shown unfiltered. ${site} may have changed its layout.`,
    };
  }
  if (found >= MIN_ITEMS_FOR_EMPTY && empty / found > EMPTY_RATIO) {
    return {
      status: 'warn',
      message: `${empty} of ${found} items had no text and were shown unfiltered. ${site} may have changed its layout.`,
    };
  }
  return { status: 'ok', message: `Checking ${items(found)} on this page.` };
}

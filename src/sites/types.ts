import type { ItemFacts, SourceRef } from '../core/model';

// One per tuned site. Selectors are data so a DOM change is a one-line fix plus a fixture.
export interface SiteAdapter {
  id: string;
  label: string;
  hosts: string[];
  itemSelector: string;
  // Extra host check when several adapters share a parent domain (google.com).
  appliesTo?(host: string): boolean;
  // Match items by source only, never by keyword (GitHub).
  sourcesOnly?: boolean;
  extract(el: Element): ItemFacts;
  // Elements hidden together with the item (Hacker News's subtext + spacer rows).
  related?(el: Element): Element[];
  // The source that owns the current page (a subreddit, channel, GitHub owner…).
  pageSource?(url: URL): SourceRef | null;
  // Whether this page is a feed the adapter should find items on. The health check only warns
  // about "no items" where this is true (missing = never warn).
  expectsItems?(url: URL): boolean;
}

export interface Tweak {
  id: string;
  site: string;
  label: string;
  css?: string;
  // For behaviour CSS can't express. Returns a cleanup function.
  run?(doc: Document): () => void;
}

import type { LogEntry } from '../content/engine';
import type { Health, HealthStats } from '../core/health';

export type Message =
  | { type: 'scrim:count'; count: number } // content → background (badge)
  | { type: 'scrim:getLog' } // popup → content
  | { type: 'scrim:reveal'; on: boolean } // popup → content
  | { type: 'scrim:peek'; domain: string } // block page → background
  | { type: 'scrim:sync' } // block page → background, resolves after rules update
  // background (context menu) → content: act on the right-clicked post
  | { type: 'scrim:menu'; action: 'hide'; topicId: string }
  | { type: 'scrim:menu'; action: 'allow' };

export interface LogResponse {
  log: LogEntry[];
  counts: Record<string, number>;
  total: number;
  revealed: boolean;
  health: Health;
  // Copied by the popup's "Copy diagnostics" button. Path only: no query string, no page content.
  diagnostics: Diagnostics;
}

export interface Diagnostics extends HealthStats {
  scrim: string; // extension version
  site: string; // adapter id
  path: string;
  itemSelector: string;
  status: Health['status'];
}

import type { LogEntry } from '../content/engine';

export type Message =
  | { type: 'scrim:count'; count: number } // content → background (badge)
  | { type: 'scrim:getLog' } // popup → content
  | { type: 'scrim:reveal'; on: boolean } // popup → content
  | { type: 'scrim:peek'; domain: string } // block page → background
  | { type: 'scrim:sync' }; // block page → background, resolves after rules update

export interface LogResponse {
  log: LogEntry[];
  counts: Record<string, number>;
  total: number;
  revealed: boolean;
}

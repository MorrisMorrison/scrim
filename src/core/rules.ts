// declarativeNetRequest rule generation. Plain objects with string literal types;
// the background casts them to the browser's enum-typed Rule at the one call site.
import { hostMatches, normalizeHost } from './host';
import type { Topic } from './model';
import { activeTopics, type ScrimState } from './store';

export const BLOCK_RULE_ID_BASE = 1000;
export const PEEK_MINUTES = 5;

export interface RedirectRule {
  id: number;
  priority: 1;
  action: { type: 'redirect'; redirect: { regexSubstitution: string } };
  condition: { regexFilter: string; requestDomains: string[]; resourceTypes: ['main_frame'] };
}

export interface AllowRule {
  id: number;
  priority: 2;
  action: { type: 'allow' };
  condition: { requestDomains: string[]; resourceTypes: ['main_frame'] };
}

export function blockedDomains(state: ScrimState): string[] {
  if (!state.settings.enabled) return [];
  const out = new Set<string>();
  for (const topic of activeTopics(state)) {
    for (const site of topic.blockSites) {
      const domain = normalizeHost(site);
      if (domain && !state.settings.disabledSites.some((d) => hostMatches(domain, d))) {
        out.add(domain);
      }
    }
  }
  return [...out].sort();
}

// "\0" is the whole matched URL; it lands in the block page's hash.
export function buildBlockRules(state: ScrimState, blockPageUrl: string): RedirectRule[] {
  return blockedDomains(state).map((domain, i) => ({
    id: BLOCK_RULE_ID_BASE + i,
    priority: 1,
    action: { type: 'redirect', redirect: { regexSubstitution: `${blockPageUrl}#\\0` } },
    condition: { regexFilter: '^.+$', requestDomains: [domain], resourceTypes: ['main_frame'] },
  }));
}

export function peekRule(id: number, domain: string): AllowRule {
  return {
    id,
    priority: 2,
    action: { type: 'allow' },
    condition: { requestDomains: [domain], resourceTypes: ['main_frame'] },
  };
}

export function blockingTopic(
  state: ScrimState,
  host: string,
): { topic: Topic; domain: string } | null {
  const blocked = blockedDomains(state);
  for (const topic of activeTopics(state)) {
    for (const site of topic.blockSites) {
      const domain = normalizeHost(site);
      if (blocked.includes(domain) && hostMatches(host, domain)) return { topic, domain };
    }
  }
  return null;
}

export function newlyBlocked(prev: readonly string[], next: readonly string[]): string[] {
  return next.filter((d) => !prev.includes(d));
}

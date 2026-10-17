// Owns the declarativeNetRequest rules. Rule objects come from core/rules.ts (pure,
// tested); this file only talks to the browser.
import { browser, type Browser } from 'wxt/browser';
import { hostMatches } from '../core/host';
import { blockedDomains, buildBlockRules, newlyBlocked, peekRule, PEEK_MINUTES } from '../core/rules';
import { loadState } from '../core/store';
import { localKV } from '../platform/kv';

type Rule = Browser.declarativeNetRequest.Rule;

const LAST_DOMAINS_KEY = 'blockedDomains';
let queue: Promise<void> = Promise.resolve();

// Runs one at a time: overlapping updateDynamicRules calls would collide on rule ids.
export function syncBlockRules(): Promise<void> {
  const run = queue.catch(() => undefined).then(doSync);
  queue = run;
  return run;
}

async function doSync(): Promise<void> {
  const state = await loadState(localKV);
  const rules = buildBlockRules(state, browser.runtime.getURL('/block.html'));
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    // core/rules.ts uses string literals; the browser types use enums with the same values.
    addRules: rules as unknown as Rule[],
  });

  const domains = blockedDomains(state);
  const stored = await browser.storage.session.get(LAST_DOMAINS_KEY);
  const previous = (stored[LAST_DOMAINS_KEY] as string[] | undefined) ?? [];
  await browser.storage.session.set({ [LAST_DOMAINS_KEY]: domains });
  const fresh = newlyBlocked(previous, domains);
  if (!fresh.length) return;

  // Tabs already sitting on a newly blocked site get reloaded onto the block page.
  for (const tab of await browser.tabs.query({})) {
    if (tab.id === undefined || !tab.url) continue;
    let host: string;
    try {
      host = new URL(tab.url).hostname;
    } catch {
      continue;
    }
    if (fresh.some((d) => hostMatches(host, d))) void browser.tabs.reload(tab.id);
  }
}

export async function startSitePeek(domain: string): Promise<void> {
  const existing = await browser.declarativeNetRequest.getSessionRules();
  const prior = existing.find((r) => r.condition.requestDomains?.includes(domain));
  const id = prior?.id ?? Math.max(0, ...existing.map((r) => r.id)) + 1;
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: prior ? [prior.id] : [],
    addRules: [peekRule(id, domain) as unknown as Rule],
  });
  await browser.alarms.create(`peek:${id}`, { delayInMinutes: PEEK_MINUTES });
}

export async function endSitePeek(alarmName: string): Promise<void> {
  const id = Number(alarmName.slice('peek:'.length));
  if (Number.isInteger(id)) await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [id] });
}

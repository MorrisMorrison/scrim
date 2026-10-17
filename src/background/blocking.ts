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

// Rule changes run one at a time: overlapping updates would collide on rule ids.
function serial(task: () => Promise<void>): Promise<void> {
  const run = queue.catch(() => undefined).then(task);
  queue = run;
  return run;
}

export function syncBlockRules(): Promise<void> {
  return serial(doSync);
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
  await reloadTabsOn(fresh);
}

async function reloadTabsOn(domains: string[]): Promise<void> {
  for (const tab of await browser.tabs.query({})) {
    if (tab.id === undefined || !tab.url) continue;
    let host: string;
    try {
      host = new URL(tab.url).hostname;
    } catch {
      continue;
    }
    if (domains.some((d) => hostMatches(host, d))) browser.tabs.reload(tab.id).catch(() => {});
  }
}

const PEEK_ALARM = 'peek:';

export function startSitePeek(domain: string): Promise<void> {
  return serial(async () => {
    const existing = await browser.declarativeNetRequest.getSessionRules();
    const prior = existing.find((r) => r.condition.requestDomains?.includes(domain));
    const id = prior?.id ?? Math.max(0, ...existing.map((r) => r.id)) + 1;
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: prior ? [prior.id] : [],
      addRules: [peekRule(id, domain) as unknown as Rule],
    });
    await browser.alarms.create(PEEK_ALARM + domain, { delayInMinutes: PEEK_MINUTES });
  });
}

// Alarm "peek:<domain>" fired: drop the allow rule, and send open tabs of a still-blocked
// domain back to the block page.
export function endSitePeek(alarmName: string): Promise<void> {
  const domain = alarmName.slice(PEEK_ALARM.length);
  return serial(async () => {
    const existing = await browser.declarativeNetRequest.getSessionRules();
    const ids = existing.filter((r) => r.condition.requestDomains?.includes(domain)).map((r) => r.id);
    if (!ids.length) return;
    await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids });
    const blocked = await browser.declarativeNetRequest.getDynamicRules();
    if (blocked.some((r) => r.condition.requestDomains?.includes(domain))) await reloadTabsOn([domain]);
  });
}

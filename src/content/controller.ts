// Glue between storage, the engine, tweaks and the page-block overlay for one tab.
import { browser } from 'wxt/browser';
import { assessHealth } from '../core/health';
import { blockMessage } from '../core/messages';
import { buildPipeline, type Pipeline } from '../core/pipeline';
import { formatSource, sourceKey } from '../core/sources';
import {
  activeProfile,
  activeTopics,
  allTopics,
  filteringActive,
  findTopic,
  loadState,
  type ScrimState,
} from '../core/store';
import { localKV, onStoreChanged } from '../platform/kv';
import type { Diagnostics, LogResponse, Message } from '../platform/messages';
import { peekEnd, startPeek } from '../platform/peek';
import { tweaksForSite } from '../sites';
import type { SiteAdapter } from '../sites/types';
import { Engine } from './engine';
import { latestRun } from './latest';
import { hidePageBlock, showPageBlock } from './overlay';
import { ACTION_CSS, prehideCss, setStyle, STYLE_IDS } from './styles';
import { TweakManager } from './tweaks';

export async function runContent(
  adapter: SiteAdapter,
  onNavigate: (cb: (url: URL) => void) => void,
): Promise<void> {
  const doc = document;
  const startedAt = Date.now();
  let state: ScrimState;
  let pipeline: Pipeline = buildPipeline([]);
  let countTimer: ReturnType<typeof setTimeout> | undefined;

  const reportCount = () => {
    if (countTimer !== undefined) return;
    countTimer = setTimeout(() => {
      countTimer = undefined;
      const msg: Message = { type: 'scrim:count', count: engine.total() };
      browser.runtime.sendMessage(msg).catch(() => {});
    }, 250);
  };

  const engine = new Engine({ adapter, doc, onHit: reportCount });
  const tweaks = new TweakManager(doc, tweaksForSite(adapter.id));

  const failOpen = (e: unknown) => {
    console.error('[scrim] content script failed; showing everything', e);
    setStyle(doc, STYLE_IDS.prehide, null);
  };

  const beginCheck = latestRun();
  let peekTimer: ReturnType<typeof setTimeout> | undefined;

  // Peeks expire: look at the page again then, so the block comes back.
  const recheckAt = (until: number) => {
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => void checkPage().catch(failOpen), Math.max(0, until - Date.now()) + 50);
  };

  // url is always a committed URL (see content/navigation.ts); it defaults to location.href.
  async function checkPage(url: URL = new URL(location.href)): Promise<void> {
    const isCurrent = beginCheck();
    const ref = adapter.pageSource?.(url) ?? null;
    const verdict = ref ? pipeline.evaluate({ text: '', sources: [ref] }) : null;
    const peekUntil = ref && verdict ? await peekEnd(sourceKey(ref)) : null;
    // A newer navigation started while we awaited: it owns the overlay now.
    if (!isCurrent()) return;
    clearTimeout(peekTimer);
    if (!ref || !verdict || peekUntil !== null) {
      hidePageBlock(doc);
      if (peekUntil !== null) recheckAt(peekUntil);
      return;
    }
    const topicName = findTopic(state, verdict.topicId)?.name ?? verdict.topicId;
    const profileName = activeProfile(state).name;
    showPageBlock(doc, {
      message: blockMessage({ site: formatSource(ref), topic: topicName, profile: profileName }),
      detail: `${topicName} · ${profileName}`,
      onPeek: () => {
        startPeek(sourceKey(ref))
          .then((until) => {
            if (!isCurrent()) return; // the user has moved on to another page
            hidePageBlock(doc);
            recheckAt(until);
          })
          .catch(failOpen);
      },
    });
  }

  function apply(): void {
    try {
      const on = filteringActive(state, location.hostname);
      const profile = activeProfile(state);
      const topics = on ? activeTopics(state) : [];
      pipeline = buildPipeline(topics);
      setStyle(doc, STYLE_IDS.prehide, topics.length ? prehideCss(adapter.itemSelector) : null);
      engine.configure({
        pipeline,
        action: profile.action,
        topicNames: Object.fromEntries(allTopics(state).map((t) => [t.id, t.name])),
      });
      tweaks.apply(on ? profile.tweaks : {});
      void checkPage().catch(failOpen);
      reportCount();
    } catch (e) {
      failOpen(e);
    }
  }

  // Site health for the popup: is the adapter still finding and reading this site's items?
  function healthReport(): Pick<LogResponse, 'health' | 'diagnostics'> {
    const stats = engine.getStats();
    const health = assessHealth({
      site: adapter.label,
      active: !pipeline.empty,
      expectsItems: adapter.expectsItems?.(new URL(location.href)) ?? false,
      elapsedMs: Date.now() - startedAt,
      stats,
    });
    const diagnostics: Diagnostics = {
      scrim: browser.runtime.getManifest().version,
      site: adapter.id,
      path: location.pathname,
      itemSelector: adapter.itemSelector,
      status: health.status,
      ...stats,
    };
    return { health, diagnostics };
  }

  setStyle(doc, STYLE_IDS.actions, ACTION_CSS);
  try {
    state = await loadState(localKV);
    apply();
    engine.start();
  } catch (e) {
    failOpen(e);
    return;
  }

  onStoreChanged(() => {
    loadState(localKV)
      .then((next) => {
        state = next;
        apply();
      })
      .catch(failOpen);
  });

  onNavigate((url) => void checkPage(url).catch(failOpen));

  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    if (msg.type === 'scrim:reveal') {
      engine.setReveal(msg.on);
      return;
    }
    if (msg.type === 'scrim:getLog') {
      const response: LogResponse = {
        log: engine.getLog(),
        counts: engine.getCounts(),
        total: engine.total(),
        revealed: engine.isRevealed(),
        ...healthReport(),
      };
      sendResponse(response);
    }
  });
}

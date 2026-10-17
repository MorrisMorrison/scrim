// Glue between storage, the engine, tweaks and the page-block overlay for one tab.
import { browser } from 'wxt/browser';
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
import type { LogResponse, Message } from '../platform/messages';
import { isPeeking, startPeek } from '../platform/peek';
import { tweaksForSite } from '../sites';
import type { SiteAdapter } from '../sites/types';
import { Engine } from './engine';
import { hidePageBlock, showPageBlock } from './overlay';
import { ACTION_CSS, prehideCss, setStyle, STYLE_IDS } from './styles';
import { TweakManager } from './tweaks';

export async function runContent(
  adapter: SiteAdapter,
  onNavigate: (cb: () => void) => void,
): Promise<void> {
  const doc = document;
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

  async function checkPage(): Promise<void> {
    const ref = adapter.pageSource?.(new URL(location.href)) ?? null;
    const verdict = ref ? pipeline.evaluate({ text: '', sources: [ref] }) : null;
    if (!ref || !verdict || (await isPeeking(sourceKey(ref)))) {
      hidePageBlock(doc);
      return;
    }
    const topicName = findTopic(state, verdict.topicId)?.name ?? verdict.topicId;
    const profileName = activeProfile(state).name;
    showPageBlock(doc, {
      message: blockMessage({ site: formatSource(ref), topic: topicName, profile: profileName }),
      detail: `${topicName} · ${profileName}`,
      onPeek: () => {
        void startPeek(sourceKey(ref)).then(() => hidePageBlock(doc));
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

  onNavigate(() => void checkPage().catch(failOpen));

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
      };
      sendResponse(response);
    }
  });
}

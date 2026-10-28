import { browser } from 'wxt/browser';
import { setBadge } from '../background/badge';
import { endSitePeek, startSitePeek, syncBlockRules } from '../background/blocking';
import { menuMessage, syncMenus } from '../background/menus';
import { seedIfEmpty } from '../core/store';
import { localKV, onStoreChanged } from '../platform/kv';
import type { Message } from '../platform/messages';

export default defineBackground(() => {
  const sync = () => syncBlockRules().catch((e) => console.error('[scrim] rule sync failed', e));
  const menus = () => syncMenus().catch((e) => console.error('[scrim] menu sync failed', e));

  // Content scripts keep page-source peeks in storage.session.
  void browser.storage.session.setAccessLevel({
    accessLevel: browser.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS,
  });
  void browser.action.setBadgeBackgroundColor({ color: '#d33333' });

  browser.runtime.onInstalled.addListener(() => {
    void seedIfEmpty(localKV).then(() => Promise.all([sync(), menus()]));
  });
  browser.runtime.onStartup.addListener(() => void Promise.all([sync(), menus()]));
  onStoreChanged(() => void Promise.all([sync(), menus()]));

  // In-page feedback: forward the right-click choice to the content script of the clicked tab
  // (top frame only; Scrim doesn't run in iframes).
  browser.contextMenus.onClicked.addListener((info, tab) => {
    const msg = menuMessage(info.menuItemId);
    if (!msg || tab?.id === undefined || (info.frameId ?? 0) !== 0) return;
    browser.tabs.sendMessage(tab.id, msg, { frameId: 0 }).catch(() => {});
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('peek:')) {
      endSitePeek(alarm.name).catch((e) => console.error('[scrim] ending peek failed', e));
    }
  });

  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') setBadge(tabId, 0);
  });

  browser.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
    switch (msg.type) {
      case 'scrim:count':
        if (sender.tab?.id !== undefined) setBadge(sender.tab.id, msg.count);
        return;
      case 'scrim:peek':
        startSitePeek(msg.domain).then(
          () => sendResponse({ ok: true }),
          (e: unknown) => sendResponse({ ok: false, error: String(e) }),
        );
        return true;
      case 'scrim:sync':
        sync().then(() => sendResponse({ ok: true }));
        return true;
    }
  });
});

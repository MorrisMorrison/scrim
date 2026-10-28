// The right-click menu on tuned sites ("Scrim → Hide posts from this source in… / Always show").
// Items come from core/menus.ts; this file only talks to the browser.
import { browser } from 'wxt/browser';
import { hideTopicId, MENU_ALLOW, menuItems } from '../core/menus';
import { allTopics, loadState } from '../core/store';
import { localKV } from '../platform/kv';
import type { Message } from '../platform/messages';
import { CONTENT_MATCHES } from '../sites';

let queue: Promise<void> = Promise.resolve();

// Rebuilt whenever settings change (topic names, custom topics). One run at a time: overlapping
// removeAll/create calls would collide on item ids.
export function syncMenus(): Promise<void> {
  const run = queue.catch(() => undefined).then(rebuild);
  queue = run;
  return run;
}

async function rebuild(): Promise<void> {
  const state = await loadState(localKV);
  await browser.contextMenus.removeAll();
  for (const item of menuItems(allTopics(state))) {
    browser.contextMenus.create({
      id: item.id,
      title: item.title,
      ...(item.parentId ? { parentId: item.parentId } : {}),
      contexts: ['all'],
      documentUrlPatterns: CONTENT_MATCHES,
    });
  }
}

// Turn a menu click into a message for the content script in the clicked tab. Only the top frame
// runs Scrim, so clicks inside iframes are ignored.
export function menuMessage(menuItemId: string | number): Message | null {
  const topicId = hideTopicId(String(menuItemId));
  if (topicId) return { type: 'scrim:menu', action: 'hide', topicId };
  if (menuItemId === MENU_ALLOW) return { type: 'scrim:menu', action: 'allow' };
  return null;
}

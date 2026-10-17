import { browser } from 'wxt/browser';

export function setBadge(tabId: number, count: number): void {
  // The tab may have closed or navigated meanwhile ("No tab with id"); that's expected.
  browser.action.setBadgeText({ tabId, text: count ? String(count) : '' }).catch(() => {});
}

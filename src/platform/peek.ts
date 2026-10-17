// Page-source peeks (GitHub org pages, blocked subreddit/channel pages). Lives in
// storage.session, which the background opens to content scripts at startup.
import { browser } from 'wxt/browser';
import { PEEK_MINUTES } from '../core/rules';

const key = (k: string) => `peek:${k}`;

export async function isPeeking(sourceKey: string): Promise<boolean> {
  try {
    const stored = await browser.storage.session.get(key(sourceKey));
    const until = stored[key(sourceKey)];
    return typeof until === 'number' && until > Date.now();
  } catch {
    return false;
  }
}

export async function startPeek(sourceKey: string): Promise<void> {
  await browser.storage.session.set({ [key(sourceKey)]: Date.now() + PEEK_MINUTES * 60_000 });
}

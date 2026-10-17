// Page-source peeks (GitHub org pages, blocked subreddit/channel pages). Lives in
// storage.session, which the background opens to content scripts at startup.
import { browser } from 'wxt/browser';
import { PEEK_MINUTES } from '../core/rules';

const key = (k: string) => `peek:${k}`;

// When the active peek on this source ends (ms timestamp), or null if there is none.
export async function peekEnd(sourceKey: string): Promise<number | null> {
  try {
    const stored = await browser.storage.session.get(key(sourceKey));
    const until = stored[key(sourceKey)];
    return typeof until === 'number' && until > Date.now() ? until : null;
  } catch {
    return null;
  }
}

// Starts a peek and returns when it ends.
export async function startPeek(sourceKey: string): Promise<number> {
  const until = Date.now() + PEEK_MINUTES * 60_000;
  await browser.storage.session.set({ [key(sourceKey)]: until });
  return until;
}

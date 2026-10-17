import { browser } from 'wxt/browser';
import type { KV } from '../core/store';

export const localKV: KV = {
  async getAll() {
    return (await browser.storage.local.get(null)) as Record<string, unknown>;
  },
  async set(items) {
    await browser.storage.local.set(items);
  },
  async remove(keys) {
    await browser.storage.local.remove(keys);
  },
};

export function onStoreChanged(cb: () => void): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (_changes, area) => {
    if (area === 'local') cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

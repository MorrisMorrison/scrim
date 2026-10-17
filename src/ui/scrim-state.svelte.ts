import { loadState, type ScrimState } from '../core/store';
import { localKV, onStoreChanged } from '../platform/kv';

// Replaced wholesale on every storage change. $state.raw keeps values as plain objects
// (no proxies), so they can be spread straight back into browser.storage.
export function createStateStore() {
  let state = $state.raw<ScrimState | null>(null);
  const reload = () =>
    loadState(localKV).then((next) => {
      state = next;
    });
  void reload();
  const stop = onStoreChanged(() => void reload());
  return {
    get state() {
      return state;
    },
    stop,
  };
}

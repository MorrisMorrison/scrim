import type { Tweak } from '../sites/types';
import { setStyle, STYLE_IDS } from './styles';

// All enabled tweak CSS lives in one <style> injected at document_start (no flash);
// run() behaviours are started once and cleaned up when disabled.
export class TweakManager {
  private cleanups = new Map<string, () => void>();

  constructor(
    private readonly doc: Document,
    private readonly tweaks: readonly Tweak[],
  ) {}

  apply(enabled: Record<string, boolean>): void {
    const on = this.tweaks.filter((t) => enabled[t.id]);
    const css = on.map((t) => t.css ?? '').filter(Boolean).join('\n');
    setStyle(this.doc, STYLE_IDS.tweaks, css || null);

    for (const [id, cleanup] of this.cleanups) {
      if (!enabled[id]) {
        cleanup();
        this.cleanups.delete(id);
      }
    }
    for (const t of on) {
      if (!t.run || this.cleanups.has(t.id)) continue;
      try {
        this.cleanups.set(t.id, t.run(this.doc));
      } catch (e) {
        console.warn('[scrim] tweak failed', t.id, e);
      }
    }
  }
}

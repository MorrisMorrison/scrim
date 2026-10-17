// Evaluates the current adapter's items against the compiled pipeline and applies the
// profile's action. Fail-open by construction: unknown → shown after the timeout,
// extract() errors → shown.
import type { Action, Verdict } from '../core/model';
import type { Pipeline } from '../core/pipeline';
import type { SiteAdapter } from '../sites/types';
import { applyAction, clearActions, failOpen, SCRIM_ATTR } from './actions';

export const PENDING_TIMEOUT_MS = 800;
export const LOG_LIMIT = 300;
export const LOG_VIEW = 100;

export interface LogEntry {
  snippet: string;
  topicId: string;
  reason: string;
}

export interface EngineConfig {
  pipeline: Pipeline;
  action: Action;
  topicNames: Record<string, string>;
}

export interface EngineOptions {
  adapter: SiteAdapter;
  doc: Document;
  pendingTimeoutMs?: number;
  onHit?: () => void;
}

export class Engine {
  private config: EngineConfig | null = null;
  private firstSeen = new WeakMap<Element, number>();
  private log: LogEntry[] = [];
  private counts: Record<string, number> = {};
  private observer: MutationObserver | null = null;
  private frameQueued = false;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: EngineOptions) {}

  configure(config: EngineConfig | null): void {
    this.config = config;
    this.reset();
    this.scan();
  }

  scan(): void {
    const config = this.config;
    if (!config || config.pipeline.empty) return;
    const { adapter, doc } = this.opts;
    const timeout = this.opts.pendingTimeoutMs ?? PENDING_TIMEOUT_MS;
    const now = Date.now();
    let pending = false;

    for (const el of Array.from(doc.querySelectorAll(adapter.itemSelector))) {
      // One broken item must never abort the loop: it would leave this item and every later
      // one attribute-less, i.e. permanently invisible under the pre-hide stylesheet.
      try {
        if (this.evaluateItem(el, config, timeout, now)) pending = true;
      } catch {
        failOpen(el);
      }
    }

    if (pending && this.pendingTimer === null) {
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.scan();
      }, timeout);
    }
  }

  start(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(this.opts.doc.documentElement, { childList: true, subtree: true });
    this.scan();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }

  setReveal(on: boolean): void {
    this.opts.doc.documentElement.classList.toggle('scrim-reveal', on);
  }

  isRevealed(): boolean {
    return this.opts.doc.documentElement.classList.contains('scrim-reveal');
  }

  getLog(): LogEntry[] {
    return this.log.slice(-LOG_VIEW).reverse();
  }

  getCounts(): Record<string, number> {
    return { ...this.counts };
  }

  total(): number {
    return Object.values(this.counts).reduce((a, b) => a + b, 0);
  }

  // Returns true when the item is still pending (empty shell waiting for hydration).
  private evaluateItem(el: Element, config: EngineConfig, timeout: number, now: number): boolean {
    const { adapter } = this.opts;
    if (el.hasAttribute(SCRIM_ATTR)) return false;
    // Inside an already-hit item: hidden with its parent, never counted twice.
    if (el.parentElement?.closest(`[${SCRIM_ATTR}^="hit"]`)) {
      el.setAttribute(SCRIM_ATTR, 'pass');
      return false;
    }
    const { text, sources } = adapter.extract(el);
    const verdict = config.pipeline.evaluate({ text: adapter.sourcesOnly ? '' : text, sources });
    if (verdict) {
      this.hit(el, verdict, text, config);
      return false;
    }
    if (text.trim()) {
      el.setAttribute(SCRIM_ATTR, 'pass');
      return false;
    }
    // Feeds render empty shells and hydrate text later: wait, but not forever.
    const seen = this.firstSeen.get(el);
    if (seen === undefined) {
      this.firstSeen.set(el, now);
      return true;
    }
    if (now - seen >= timeout) {
      el.setAttribute(SCRIM_ATTR, 'pass');
      return false;
    }
    return true;
  }

  private schedule(): void {
    if (!this.observer || this.frameQueued) return;
    this.frameQueued = true;
    requestAnimationFrame(() => {
      this.frameQueued = false;
      if (this.observer) this.scan();
    });
  }

  private hit(el: Element, verdict: Verdict, text: string, config: EngineConfig): void {
    const related = this.opts.adapter.related?.(el) ?? [];
    applyAction(el, related, config.action, verdict, config.topicNames[verdict.topicId] ?? verdict.topicId);
    const snippet =
      text
        .split('\n')
        .map((s) => s.trim())
        .find(Boolean)
        ?.slice(0, 120) ?? '(no visible text)';
    this.log.push({ snippet, topicId: verdict.topicId, reason: verdict.reason });
    if (this.log.length > LOG_LIMIT) this.log.shift();
    this.counts[verdict.topicId] = (this.counts[verdict.topicId] ?? 0) + 1;
    try {
      this.opts.onHit?.();
    } catch {
      // A listener failure (e.g. extension context invalidated) must not affect scanning.
    }
  }

  private reset(): void {
    clearActions(this.opts.doc);
    this.firstSeen = new WeakMap();
    this.log = [];
    this.counts = {};
    if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}

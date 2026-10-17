// Evaluates the current adapter's items against the compiled pipeline and applies the
// profile's action. Fail-open by construction: unknown → shown after the timeout,
// extract() errors → shown.
import type { Action, SourceRef, Verdict } from '../core/model';
import type { Pipeline } from '../core/pipeline';
import type { SiteAdapter } from '../sites/types';
import { applyAction, clearActions, SCRIM_ATTR } from './actions';

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
      if (el.hasAttribute(SCRIM_ATTR)) continue;
      // Inside an already-hit item: hidden with its parent, never counted twice.
      if (el.parentElement?.closest(`[${SCRIM_ATTR}^="hit"]`)) {
        el.setAttribute(SCRIM_ATTR, 'pass');
        continue;
      }
      let text: string;
      let sources: SourceRef[];
      try {
        ({ text, sources } = adapter.extract(el));
      } catch {
        el.setAttribute(SCRIM_ATTR, 'pass');
        continue;
      }
      const verdict = config.pipeline.evaluate({ text: adapter.sourcesOnly ? '' : text, sources });
      if (verdict) {
        this.hit(el, verdict, text, config);
        continue;
      }
      if (text.trim()) {
        el.setAttribute(SCRIM_ATTR, 'pass');
        continue;
      }
      // Feeds render empty shells and hydrate text later: wait, but not forever.
      const seen = this.firstSeen.get(el);
      if (seen === undefined) {
        this.firstSeen.set(el, now);
        pending = true;
      } else if (now - seen >= timeout) {
        el.setAttribute(SCRIM_ATTR, 'pass');
      } else {
        pending = true;
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

  private schedule(): void {
    if (this.frameQueued) return;
    this.frameQueued = true;
    requestAnimationFrame(() => {
      this.frameQueued = false;
      this.scan();
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
    this.opts.onHit?.();
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

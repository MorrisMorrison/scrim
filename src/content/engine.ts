// Evaluates the current adapter's items against the compiled pipeline and applies the
// profile's action. Fail-open by construction: unknown → shown after the timeout,
// extract() errors → shown.
//
// Feeds reuse item elements for new content (YouTube, Reddit), so a settled item keeps a
// fingerprint: its first link (recycled tiles point somewhere new), or, for an item without
// links, the start of its text. Live text ("3 hr. ago", view counts) never changes a linked
// item's fingerprint, so it is never cleared, re-hidden or counted twice. Keeping it cheap:
// - Each pass queries only unsettled items (`:not([data-scrim])`), never the whole feed.
// - The MutationObserver watches childList and href changes and remembers which nodes
//   changed; the next frame re-checks only the settled items containing them.
// - A linked item is re-checked by comparing one attribute; only a changed or link-less
//   item is extracted.
// - An explicit scan() re-checks every settled item.
// A settled item whose fingerprint changed is cleared and evaluated afresh.
import type { Action, ItemFacts, Verdict } from '../core/model';
import type { Pipeline } from '../core/pipeline';
import type { SiteAdapter } from '../sites/types';
import { applyAction, clearActions, clearItem, failOpen, SCRIM_ATTR } from './actions';

export const PENDING_TIMEOUT_MS = 800;
export const LOG_LIMIT = 300;
export const LOG_VIEW = 100;
const FINGERPRINT_TEXT = 100;

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

function linkPrint(el: Element): string | null {
  const href = el.querySelector('a[href]')?.getAttribute('href');
  return href ? `link:${href}` : null;
}

function fingerprint(el: Element, text: string): string {
  return linkPrint(el) ?? `text:${text.slice(0, FINGERPRINT_TEXT)}`;
}

// What a hit changed besides the item itself, so it can be undone when the element is reused.
interface Marks {
  related: Element[];
  bar: Element | null;
}

export class Engine {
  private config: EngineConfig | null = null;
  private firstSeen = new WeakMap<Element, number>();
  private fingerprints = new WeakMap<Element, string>();
  private marks = new WeakMap<Element, Marks>();
  // Nodes the observer saw change since the last frame.
  private touched = new Set<Node>();
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

  // Evaluates new items and re-checks every settled item for reused content.
  scan(): void {
    const { adapter, doc } = this.opts;
    this.touched.clear();
    this.run(Array.from(doc.querySelectorAll(`:is(${adapter.itemSelector})[${SCRIM_ATTR}]`)));
  }

  start(): void {
    if (this.observer) return;
    this.observer = new MutationObserver((records) => {
      for (const r of records) this.touched.add(r.target);
      this.schedule();
    });
    this.observer.observe(this.opts.doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
    this.scan();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.touched.clear();
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

  // Re-checks the given settled items for changed content, then evaluates unsettled items.
  private run(settled: Element[]): void {
    const config = this.config;
    if (!config || config.pipeline.empty) return;
    const { adapter, doc } = this.opts;
    const timeout = this.opts.pendingTimeoutMs ?? PENDING_TIMEOUT_MS;
    const now = Date.now();
    let pending = false;

    // One broken item must never abort the loop: it would leave this item and every later
    // one attribute-less, i.e. permanently invisible under the pre-hide stylesheet.
    const visit = (el: Element, facts?: ItemFacts) => {
      try {
        if (this.evaluateItem(el, config, timeout, now, facts)) pending = true;
      } catch {
        failOpen(el);
      }
    };

    for (const el of settled) {
      const before = this.fingerprints.get(el);
      if (before === undefined || !el.hasAttribute(SCRIM_ATTR)) continue;
      if (linkPrint(el) === before) continue; // same link: same item, whatever its text does
      let facts: ItemFacts;
      try {
        facts = adapter.extract(el);
      } catch {
        continue; // keep its current state
      }
      if (fingerprint(el, facts.text) === before) continue;
      this.forget(el);
      visit(el, facts);
    }

    for (const el of Array.from(doc.querySelectorAll(`:is(${adapter.itemSelector}):not([${SCRIM_ATTR}])`))) {
      visit(el);
    }

    if (pending && this.pendingTimer === null) {
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.update();
      }, timeout);
    }
  }

  // Incremental pass: unsettled items, plus settled items that contain a changed node.
  private update(): void {
    const sel = `:is(${this.opts.adapter.itemSelector})[${SCRIM_ATTR}]`;
    const settled = new Set<Element>();
    for (const node of this.touched) {
      const start = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      if (!start?.isConnected) continue;
      for (let item = start.closest(sel); item; item = item.parentElement?.closest(sel) ?? null) {
        settled.add(item);
      }
    }
    this.touched.clear();
    this.run([...settled]);
  }

  // Returns true when the item is still pending (empty shell waiting for hydration).
  private evaluateItem(
    el: Element,
    config: EngineConfig,
    timeout: number,
    now: number,
    known?: ItemFacts,
  ): boolean {
    const { adapter } = this.opts;
    if (el.hasAttribute(SCRIM_ATTR)) return false;
    // Inside an already-hit item: hidden with its parent, never counted twice.
    if (el.parentElement?.closest(`[${SCRIM_ATTR}^="hit"]`)) {
      el.setAttribute(SCRIM_ATTR, 'pass');
      return false;
    }
    const { text, sources } = known ?? adapter.extract(el);
    const verdict = config.pipeline.evaluate({ text: adapter.sourcesOnly ? '' : text, sources });
    if (verdict) {
      this.hit(el, verdict, text, config);
      this.fingerprints.set(el, fingerprint(el, text));
      return false;
    }
    if (text.trim()) {
      this.pass(el, text);
      return false;
    }
    // Feeds render empty shells and hydrate text later: wait, but not forever.
    const seen = this.firstSeen.get(el);
    if (seen === undefined) {
      this.firstSeen.set(el, now);
      return true;
    }
    if (now - seen >= timeout) {
      this.pass(el, text);
      return false;
    }
    return true;
  }

  private pass(el: Element, text: string): void {
    el.setAttribute(SCRIM_ATTR, 'pass');
    this.fingerprints.set(el, fingerprint(el, text));
  }

  // Clears a settled item (and whatever its hit marked) so it is evaluated afresh.
  private forget(el: Element): void {
    const marks = this.marks.get(el);
    clearItem(el, marks?.related ?? [], marks?.bar ?? null);
    this.marks.delete(el);
    this.fingerprints.delete(el);
    this.firstSeen.delete(el);
  }

  private schedule(): void {
    if (!this.observer || this.frameQueued) return;
    this.frameQueued = true;
    requestAnimationFrame(() => {
      this.frameQueued = false;
      if (this.observer) this.update();
    });
  }

  private hit(el: Element, verdict: Verdict, text: string, config: EngineConfig): void {
    const related = this.opts.adapter.related?.(el) ?? [];
    const topicName = config.topicNames[verdict.topicId] ?? verdict.topicId;
    const bar = applyAction(el, related, config.action, verdict, topicName);
    this.marks.set(el, { related, bar });
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
    this.fingerprints = new WeakMap();
    this.marks = new WeakMap();
    this.touched.clear();
    this.log = [];
    this.counts = {};
    if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}

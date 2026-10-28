// Evaluates the current adapter's items against the compiled pipeline and applies the
// profile's action. Fail-open by construction: unknown → shown after the timeout,
// extract() errors → shown.
//
// Feeds reuse item elements for new content (YouTube, Reddit), so a settled item keeps a
// fingerprint: its first link (recycled tiles point somewhere new), or, for an item without
// links, the start of its text. Live text ("3 hr. ago", view counts) never changes a linked
// item's fingerprint, so it is never cleared, re-hidden or counted twice.
//
// Keeping it cheap on busy pages (live chat, counters, players mutate constantly):
// - The MutationObserver only collects work: elements that were added (to look for new items
//   inside them) and the parents/links that changed (to re-check the settled items around
//   them). Removal-only records and Scrim's own nodes (collapse bars, overlay) are ignored, so
//   they never wake the engine up.
// - A frame evaluates only the new items inside added subtrees, the still-pending shells, and
//   the settled items around changes. It never queries the whole document.
// - The whole document is only queried by scan() (start, configure), when more than
//   TOUCHED_LIMIT changes piled up (e.g. a background tab without frames), and by a safety
//   scan every SAFETY_SCAN_MS while the page keeps changing (catches items that became
//   matchable without being added, e.g. a class change).
// - With nothing to filter (no active topics), the observer is disconnected entirely.
// A settled item whose fingerprint changed is cleared and evaluated afresh.
import type { HealthStats } from '../core/health';
import type { Action, ItemFacts, SourceRef, Verdict, VerdictMatch } from '../core/model';
import type { Pipeline } from '../core/pipeline';
import { pickSource } from '../core/sources';
import type { SiteAdapter } from '../sites/types';
import { applyAction, BAR_ATTR, clearActions, clearItem, failOpen, SCRIM_ATTR } from './actions';
import { OVERLAY_ID } from './overlay';
import { TOAST_ID } from './toast';

export const PENDING_TIMEOUT_MS = 800;
export const LOG_LIMIT = 300;
export const LOG_VIEW = 100;
const FINGERPRINT_TEXT = 100;
// Past this many collected changes, re-check everything instead (background tabs get no
// frames, and the sets would otherwise pin detached nodes indefinitely).
export const TOUCHED_LIMIT = 500;
// While the page keeps changing, look for unsettled items document-wide this often.
export const SAFETY_SCAN_MS = 2000;

const OWN_NODES = `[${BAR_ATTR}], #${OVERLAY_ID}, #${TOAST_ID}`;

export interface LogEntry {
  snippet: string;
  topicId: string;
  reason: string;
  // What fired and the item's most specific source: the popup offers "stop hiding this
  // keyword" / "always show this source" from these.
  match: VerdictMatch;
  source: SourceRef | null;
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

function textPrint(text: string): string {
  return `text:${text.slice(0, FINGERPRINT_TEXT)}`;
}

function fingerprint(el: Element, text: string): string {
  return linkPrint(el) ?? textPrint(text);
}

function asElement(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

// Scrim's own collapse bars and page overlay (or anything inside them).
function isOwn(node: Node): boolean {
  return asElement(node)?.closest(OWN_NODES) != null;
}

function inDocumentOrder(a: Element, b: Element): number {
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
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
  // Parents of additions and elements whose href changed since the last frame: the settled
  // items around them get re-checked for reused content.
  private touched = new Set<Node>();
  // Element roots added since the last frame: new items are looked for inside them.
  private added = new Set<Element>();
  // Items still waiting for their text to hydrate.
  private pending = new Set<Element>();
  // Too many changes piled up: the next pass re-checks everything.
  private rescanAll = false;
  // The page changed since the last document-wide look for unsettled items.
  private dirty = false;
  private started = false;
  private log: LogEntry[] = [];
  private counts: Record<string, number> = {};
  // Site health (see core/health.ts): plain counters, no extra DOM work.
  private stats: HealthStats = { found: 0, errors: 0, empty: 0 };
  private observer: MutationObserver | null = null;
  private frameQueued = false;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: EngineOptions) {}

  configure(config: EngineConfig | null): void {
    this.config = config;
    this.reset();
    this.syncObserver();
    this.scan();
  }

  // Evaluates new items and re-checks every settled item for reused content.
  scan(): void {
    this.touched.clear();
    this.added.clear();
    this.rescanAll = false;
    this.dirty = false;
    this.run(Array.from(this.opts.doc.querySelectorAll(this.settledSelector())));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.syncObserver();
    this.scan();
  }

  stop(): void {
    this.started = false;
    this.disconnect();
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

  getStats(): HealthStats {
    return { ...this.stats };
  }

  private settledSelector(): string {
    return `:is(${this.opts.adapter.itemSelector})[${SCRIM_ATTR}]`;
  }

  private unsettledSelector(): string {
    return `:is(${this.opts.adapter.itemSelector}):not([${SCRIM_ATTR}])`;
  }

  // Observe only while there is something to filter.
  private syncObserver(): void {
    const active = this.started && !!this.config && !this.config.pipeline.empty;
    if (active) this.connect();
    else this.disconnect();
  }

  private connect(): void {
    if (this.observer) return;
    this.observer = new MutationObserver((records) => this.collect(records));
    this.observer.observe(this.opts.doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
    this.safetyTimer = setInterval(() => this.safetyScan(), SAFETY_SCAN_MS);
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.safetyTimer !== null) clearInterval(this.safetyTimer);
    this.safetyTimer = null;
    this.touched.clear();
    this.added.clear();
    this.rescanAll = false;
    this.dirty = false;
  }

  // Turns mutation records into work for the next frame; schedules a frame only if there is any.
  private collect(records: MutationRecord[]): void {
    let work = false;
    for (const r of records) {
      if (this.rescanAll) break;
      if (r.type === 'attributes') {
        if (isOwn(r.target)) continue;
        this.touched.add(r.target);
        work = true;
      } else {
        this.dirty = true;
        if (r.addedNodes.length === 0 || isOwn(r.target)) continue; // removals: nothing new
        let foreign = false;
        r.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            if (isOwn(n)) return;
            this.added.add(n as Element);
          }
          foreign = true;
        });
        if (!foreign) continue;
        this.touched.add(r.target);
        work = true;
      }
      if (this.touched.size + this.added.size > TOUCHED_LIMIT) {
        this.touched.clear();
        this.added.clear();
        this.rescanAll = true;
      }
    }
    if (work || this.rescanAll) this.schedule();
  }

  private safetyScan(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.run([]);
  }

  // Re-checks the given settled items for changed content, then evaluates unsettled items:
  // the given candidates, or (without candidates) every unsettled item in the document.
  private run(settled: Element[], candidates?: Element[]): void {
    const config = this.config;
    if (!config || config.pipeline.empty) return;
    const { adapter, doc } = this.opts;
    const timeout = this.opts.pendingTimeoutMs ?? PENDING_TIMEOUT_MS;
    const now = Date.now();

    // One broken item must never abort the loop: it would leave this item and every later
    // one attribute-less, i.e. permanently invisible under the pre-hide stylesheet.
    const visit = (el: Element, facts?: ItemFacts) => {
      try {
        if (this.evaluateItem(el, config, timeout, now, facts)) this.pending.add(el);
        else this.pending.delete(el);
      } catch {
        this.pending.delete(el);
        this.stats.found++;
        this.stats.errors++;
        failOpen(el);
      }
    };

    for (const el of settled) {
      try {
        const before = this.fingerprints.get(el);
        if (before === undefined || !el.hasAttribute(SCRIM_ATTR)) continue;
        if (linkPrint(el) === before) continue; // same link: same item, whatever its text does
        const facts = adapter.extract(el); // throws → keeps its current state (see catch)
        const current = fingerprint(el, facts.text);
        if (current === before) continue;
        if (before === textPrint(facts.text)) {
          // Same text, and a link has hydrated since: same item, just fingerprint it by link.
          this.fingerprints.set(el, current);
          continue;
        }
        this.forget(el);
        visit(el, facts);
      } catch {
        // A half-cleared item must never stay attribute-less (pre-hidden): show it.
        if (!el.hasAttribute(SCRIM_ATTR)) failOpen(el);
      }
    }

    const fresh = candidates ?? Array.from(doc.querySelectorAll(this.unsettledSelector()));
    for (const el of fresh) visit(el);

    if (this.pending.size > 0 && this.pendingTimer === null) {
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.update();
      }, timeout);
    }
  }

  // Incremental pass: new items inside added subtrees, pending shells, and the settled items
  // around changed nodes.
  private update(): void {
    if (this.rescanAll) {
      this.scan();
      return;
    }
    const settledSel = this.settledSelector();
    const unsettledSel = this.unsettledSelector();

    // Settled items containing a changed node; shared ancestors are walked once.
    const settled = new Set<Element>();
    const visited = new Set<Element>();
    for (const node of this.touched) {
      for (let el = asElement(node); el?.isConnected; el = el.parentElement) {
        if (visited.has(el)) break;
        visited.add(el);
        if (el.matches(settledSel)) settled.add(el);
      }
    }

    const fresh = new Set<Element>();
    for (const root of this.added) {
      if (!root.isConnected) continue;
      if (root.matches(unsettledSel)) fresh.add(root);
      root.querySelectorAll(unsettledSel).forEach((el) => fresh.add(el));
    }
    for (const el of this.pending) {
      if (el.isConnected && !el.hasAttribute(SCRIM_ATTR)) fresh.add(el);
      else this.pending.delete(el);
    }

    this.touched.clear();
    this.added.clear();
    // Parents before children, so a nested item sees its parent's verdict (never counted twice).
    this.run([...settled], [...fresh].sort(inDocumentOrder));
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
      this.hit(el, verdict, text, sources, config);
      this.fingerprints.set(el, fingerprint(el, text));
      this.stats.found++;
      return false;
    }
    if (text.trim()) {
      this.pass(el, text);
      this.stats.found++;
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
      this.stats.found++;
      this.stats.empty++;
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

  private hit(el: Element, verdict: Verdict, text: string, sources: SourceRef[], config: EngineConfig): void {
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
    this.log.push({
      snippet,
      topicId: verdict.topicId,
      reason: verdict.reason,
      match: verdict.match,
      source: pickSource(sources),
    });
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
    this.added.clear();
    this.pending.clear();
    this.rescanAll = false;
    this.log = [];
    this.counts = {};
    this.stats = { found: 0, errors: 0, empty: 0 };
    if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}

# Scrim performance: analysis and fix plan

- **Date:** 2026-10-18
- **Scope:** content-script hot paths (`src/content/engine.ts`, `src/sites/dom.ts`, `src/core/pipeline.ts`, Google AI Overview tweak), plus the controller and background.

## How the cost was measured

A throwaway Vitest benchmark (Node + happy-dom, not Chrome) measured the matcher and text extraction:

| Operation | Cost |
|---|---|
| Pipeline, 1 topic (AI), item with no match | ~2 µs/item |
| Pipeline, all 11 topics, item with no match | ~10 µs/item |
| `buildPipeline` (11 topics) | ~0.2 ms, once per settings change |
| `richText` on an ~80-node item | ~90 µs/item (happy-dom; Chrome is much faster) |
| `linkDomains` on an item with 21 links | ~10 ms/item in happy-dom. This is suspicious: `doc.baseURI` and `new URL()` are slow there. Needs a Chrome check. |

**Conclusion:** keyword matching is not the problem. Even with every topic on, 1,000 feed items cost about 10 ms in total, spread over scrolling. The real risks are about how often the engine wakes up, and how much of the page it touches each time it does.

## Findings, ranked by likely impact

### P1. The whole document is queried on every animation frame while the page mutates
`Engine.run()` always ends with `doc.querySelectorAll(':is(<itemSelector>):not([data-scrim])')` over the whole document. `run()` is reached from `update()` on every frame in which the MutationObserver saw any change.
- YouTube, X and Reddit mutate the DOM almost constantly: live chat, comment loading, hover previews, player UI, counters.
- So on a busy page, Scrim runs a full-document selector match about 60 times a second, even when no new feed item has appeared.
- **Fix:** become incremental. Collect `addedNodes` from the observer records. For each added element, check `el.matches(sel)` and `el.querySelectorAll(sel)` on that subtree only. Keep a `Set` of pending (empty-shell) items, and re-check only those on the pending timer.
- Keep the full-document query only for `start()`, `configure()` and the overflow fallback.

### P2. The observer reacts to every mutation, including removals and our own changes
- The callback adds every `record.target` to `touched`, including removal-only records and records caused by Scrim itself (collapse bars, attribute writes).
- `update()` then runs two `closest()` walks up to the root for each touched node, with the large `:is(...)` selector.
- On a churn-heavy page that's up to 500 nodes × ~30 ancestors × a selector match, every frame.
- **Fix:**
  - Ignore `childList` records that have no `addedNodes`.
  - Ignore records inside `[data-scrim-bar]` or the overlay.
  - Within one pass, remember the ancestors already visited so shared ancestors are walked once.
  - Only `href` attribute records need the settled re-check.

### P3. The engine keeps working when there's nothing to filter
When a site is disabled, Scrim is off, or the profile has no topics:
- `run()` returns early, but the MutationObserver stays connected.
- It still fills `touched`, schedules a frame and walks `closest()` in `update()`.

**Fix:** disconnect the observer (or skip `start()`) while `pipeline.empty`, and reconnect in `configure()` when topics become active. Tweak-only profiles then cost nothing beyond their CSS.

### P4. The Google AI Overview tweak runs a second full-page observer
- `hideAiOverview.run()` observes the whole document and, on every mutated frame, re-queries all headings.
- It also reads `offsetHeight` while climbing, which forces a synchronous layout. On Google Search that happens on every frame where the page changes.
- **Fix:**
  - Check only added subtrees.
  - Read layout once per new heading, not on every pass.
  - Stop observing after the overview is found and hidden, or after ~10 s.
  - Most of the work is already done by the CSS for the known containers.

### P5. `linkDomains` parses every link with `new URL()` and reads `doc.baseURI` each time
- It runs for every item on Reddit, X, Hacker News and Google: one `new URL()` and one `baseURI` read per anchor.
- **Fix:**
  - Read `baseURI` once per call.
  - Skip same-site relative links (`/…`, `#…`, `?…`) before parsing, which is most links on Reddit and X.
  - Only parse absolute `http(s)` links.
  - Measure in Chrome first, because happy-dom exaggerates this.

### P6. The source stage normalises the same source once per topic
- `sourceStage` calls `sourceKey(src)` inside the topic loop, so 11 topics normalise each item source 11 times.
- Domain matching calls `hostMatches`, which re-normalises both hosts on every comparison.
- **Fix:**
  - Compute each item source's key and normalised host once, then probe each topic's `Set`.
  - Pre-normalise topic domains at build time.
- This is small (it's part of the ~10 µs above), but trivial to fix.

### P7. Several keyword matchers can run on every item
- Each topic has up to three regexes (case-sensitive, case-insensitive, raw), so a miss with 11 topics means about 30 scans of the text.
- **Optional fix:** build one combined "any topic" regex per flag set to reject misses in a single scan, and only fall back to per-topic matching on a hit, since most items don't match.
- Do this only if a Chrome profile shows matching at more than about 5% of Scrim's time.

### Low-priority notes (no action now)
- **Pre-hide CSS** `:is(<8 selectors>):not([data-scrim])`: cheap for Chrome's style engine. Only revisit if Chrome's style recalculation shows Scrim.
- **Settings change → `configure()` → full reset and re-scan in every open tab:** only happens when the user edits settings, so it's acceptable.
- **Background `syncBlockRules`** on every `storage.local` change: one `getDynamicRules` and `updateDynamicRules` call, with tab queries only for newly blocked domains. Fine.
- **Memory:** state is in `WeakMap`s, the log is capped at 300, and `touched` is capped at 500. Fine.

## Plan

### Step 0: measure in real Chrome (before any changes)
- Add a debug-only counter (behind a `localStorage.scrimDebug` flag) that logs per second:
  - observer records received
  - `run()` calls and their total ms
  - items evaluated
  - the time spent in `extract` and `evaluate`
- Record a 30-second Chrome Performance trace with and without Scrim on each of these:
  - a YouTube watch page with live chat
  - the YouTube home page while scrolling
  - X home while scrolling
  - Reddit home while scrolling
  - Google search results
- **Pass bar:** Scrim adds at most ~2 ms of scripting per second while idle on a page, and at most ~5% of scripting time while scrolling.

### Step 1: incremental scanning (P1 + P2)
- **Observer:** collect added element roots and `href`-changed elements. Drop removal-only records and records from Scrim's own nodes.
- **`update()`:**
  - Evaluate items inside added roots.
  - Re-check settled ancestors of `href` changes, with a per-pass visited set.
  - Re-check the pending set on its timer.
- **Unchanged:** the full scan still runs on `start()`, `configure()` and overflow. The fingerprint and fail-open behaviour stay as they are.
- **Tests:**
  - items added deep inside an existing container are found;
  - removal-only mutations do no work, measured by a call counter on `adapter.extract`;
  - Scrim's own bar insertion triggers no re-scan;
  - pending items are still re-checked;
  - every existing engine test still passes.

### Step 2: idle when there's nothing to filter (P3)
- Disconnect the observer while `pipeline.empty`, and reconnect in `configure()`.
- **Test:** with an empty pipeline, DOM mutations cause no `extract` calls and no scheduled frames.

### Step 3: Google AI Overview tweak (P4)
- Only check added subtrees, read layout once per new heading, and disconnect once found or after 10 s.
- **Test:** an overview injected late is still hidden, and cleanup still restores it.

### Step 4: cheaper extraction (P5 + P6)
- **`linkDomains`:** read `baseURI` once and skip relative links.
- **`sourceStage`:** compute source keys once per item and pre-normalise topic domains.
- **Tests:** the existing site and pipeline tests, plus one test that relative links never produce a domain source.

### Step 5: re-measure (and maybe P7)
- Repeat the Step 0 traces and compare.
- Only if matching still shows up do the combined pre-check regex (P7). Its test must show the same verdicts and reasons as per-topic matching across the shipped defaults test corpus.

Each step is independent and comes with its own tests. Steps 1–2 give the biggest win. Steps 3–4 are small. Step 5 decides whether P7 is worth doing.

## Status

Steps 1 and 2 are done. Measured with `pnpm bench` (happy-dom; the counts are exact, the timings only show the trend):

| Scenario (300 items, 100 churn frames) | Before | After |
|---|---|---|
| AI on: full-document queries | 100 | 0 |
| AI on: frames run | 100 | 100 (each now only checks what changed) |
| AI on: extract calls / new items hidden | 10 / 10 | 10 / 10 |
| AI on: time | 129 ms | 32 ms |
| Nothing to filter: frames run | 100 | 0 (observer disconnected) |
| Nothing to filter: time | 17 ms | 9 ms |

A document-wide look for unsettled items still runs at most every 2 s while the page is changing (`SAFETY_SCAN_MS`), so items that become matchable without being added (e.g. a class change) are still found.

# Scrim — Design Spec

- **Date:** 2026-10-17
- **Status:** Approved design, pending implementation plan
- **Predecessor:** [no-ai-filter](https://github.com/MorrisMorrison/no-ai-filter) (v0.6.0)

> A *scrim* is a theatre gauze that hides what's behind it until it's lit — which is
> exactly the hide / blur / peek behaviour of this extension.

## 1. Purpose

Scrim is a Chromium browser extension that filters content by **topic** rather than by a
single hard-coded category. It generalises no-ai-filter, which started as an AI filter and
grew a "no-work mode", regex keywords and GitHub work-org handling until the original
framing no longer fit.

Goals:

- Hide feed items (posts, videos, results) that belong to user-chosen topics — AI, work,
  software/IT, NSFW, or any custom topic.
- Block whole websites while a topic is active (e.g. work tools during downtime).
- Customise sites beyond content filtering (YouTube: hide Shorts, recommendations, …).
- Switch between named **profiles** ("Default", "Downtime") that bundle all of the above.

### Audience and distribution

- Open-source **public GitHub repo**, MIT license.
- **Not** published to any store. Installed via "Load unpacked". No store compliance,
  privacy policy or listing assets are needed.
- **Chromium only** (Chrome, Edge, Brave). Built with WXT so a Firefox target stays cheap
  later, but Firefox is neither tested nor shipped in v1.

### What changes versus no-ai-filter

| no-ai-filter | Problem | Scrim |
|---|---|---|
| AI list is core; dev list bolted on via `hideDev`; `noWorkBlockSites` / `noWorkGitHubOrgs` special fields | Every new category = new special-case code | Generic **topics** (keywords, sources, blocked sites) |
| One global switch + No-work mode | Modes are hard-wired | **Profiles** bundling topics, action and tweaks |
| Whole settings object in one `chrome.storage.sync` key | 8 KB per-item quota; lists outgrow it | Per-entity keys in `storage.local` + JSON export/import |
| Source matching via `includes()` | `r/AI` also blocks `r/AIArt`, `r/aiwa` | Typed sources, exact match |
| Selectors hard-coded inside logic | Breakage needs code archaeology | Declarative adapters + HTML fixture tests |
| Overlay drawn after page load for blocked sites | Content flashes; only works on supported hosts | `declarativeNetRequest` redirect, works on any domain |
| `document_idle` + 200 ms debounce | Visible flash before items hide | `document_start`, per-frame batches, pre-hide with failsafe |
| Plain JS globals, no build | Hard to grow safely | TypeScript + WXT + Vitest |
| Invalid regex silently dropped | Confusing | Inline validation in the editor |
| Defaults had to be "unfrozen" in v0.6.0 | Shipped list updates didn't reach users | Built-in topics store only user deltas |

## 2. Scope

### In v1

- Topic engine with keyword (plain + regex) and typed-source matching.
- Profiles with manual switching from the popup.
- Tuned adapters for: **Reddit, YouTube, X/Twitter, Hacker News, Google Search, Google
  News, GitHub**.
- Whole-site blocking on **any** domain.
- Page-source blocking (GitHub work-org pages, blocked subreddit / channel pages).
- Tweaks framework; YouTube tweaks and Google AI Overview stripping.
- Popup, options page, keyword tester, JSON export/import.

### Out of v1 (roadmap)

1. **Stage 2:** tweaks for further sites (Reddit, X, …).
2. **Stage 3:** profile schedules (auto-switch by time / weekday).
3. **Later:** async classifier stage (on-device model in an offscreen document), NSFW image
   detection, cross-device sync, Firefox build, LinkedIn / Facebook adapters, generic
   fallback adapter for untuned sites.

No migration from no-ai-filter: extensions cannot read each other's storage, and the
customisations are small enough to re-enter.

## 3. Data model

```ts
type SourceRef =
  | { kind: "subreddit"; name: string }      // "ChatGPT"  (displayed as r/ChatGPT)
  | { kind: "channel"; handle: string }      // YouTube "@handle" without the @
  | { kind: "x-user"; handle: string }       // X handle without the @
  | { kind: "domain"; host: string }         // "the-decoder.de"
  | { kind: "github-owner"; owner: string }; // GitHub user/org login

interface Topic {
  id: string;            // built-in: "ai" | "work" | "software" | "nsfw"; custom: uuid
  name: string;
  keywords: string[];    // plain terms or "/pattern/flags"
  sources: SourceRef[];
  blockSites: string[];  // domains redirected to the block page while active
}

type Action = "hide" | "blur" | "collapse";

interface Profile {
  id: string;
  name: string;
  topics: string[];                  // Topic ids
  action: Action;
  tweaks: Partial<Record<TweakId, boolean>>; // absent = off
}

interface GlobalSettings {
  enabled: boolean;
  activeProfileId: string;
  disabledSites: string[];           // hosts where Scrim does nothing at all
}
```

### Semantics

- **Active topics** = the active profile's `topics`. Only active topics filter items or
  block sites.
- **Global off** (`enabled: false`) disables filtering, tweaks and site blocking.
- **Disabled site** (host or parent domain in `disabledSites`) disables filtering, tweaks
  and site blocking on that host.
- **`collapse`** hides the item (and its `related()` elements) and inserts a slim bar
  ("Scrim · AI · show") before it; clicking *show* reveals that one item and removes the bar.
- **`blur`** blurs the item; click reveals it (as in no-ai-filter).

### Built-in topics as deltas

Built-in topic definitions ship in code (`core/defaults/`). Storage holds only the user's
changes, so updates to shipped lists reach every user:

```ts
interface BuiltinTopicOverride {
  added:   { keywords: string[]; sources: SourceRef[]; blockSites: string[] };
  removed: { keywords: string[]; sources: SourceRef[]; blockSites: string[] };
}
```

Effective topic = shipped list − `removed` + `added` (de-duplicated). Built-in topic names
are fixed, and built-in topics cannot be deleted — only left out of profiles. Custom topics are stored in
full and can be deleted (removing them from every profile).

### Shipped defaults

Topics:

| Topic | Keywords | Sources | blockSites |
|---|---|---|---|
| **AI** | no-ai-filter's `DEFAULT_KEYWORDS` (EN + DE + products) | — | — |
| **Software/IT** | no-ai-filter's `DEFAULT_DEV_KEYWORDS` | — | `news.ycombinator.com` |
| **Work** | — (empty) | — | — |
| **NSFW** | small conservative explicit-term list | — | — |

Profiles (seeded on first install, then fully user-owned and editable; at least one
profile must always exist):

| Profile | Topics | Action | Tweaks on |
|---|---|---|---|
| **Default** (active) | AI | hide | `google.hideAiOverview` |
| **Downtime** | AI, Work, Software/IT | hide | `google.hideAiOverview`, `youtube.hideShorts`, `youtube.hideHomeRecommendations`, `youtube.hideWatchRecommendations` |

The **Work** topic ships empty on purpose: the repo is public, so personal work orgs and
domains live only in browser storage or the user's exported JSON.

### Storage layout

`chrome.storage.local`, one key per entity:

- `settings` → `GlobalSettings`
- `profile:<id>` → `Profile`
- `topic:<id>` → custom `Topic`
- `topic-override:<builtinId>` → `BuiltinTopicOverride`
- `schemaVersion` → number (for future migrations; v1 = 1)

Enumeration uses `storage.local.get(null)` filtered by key prefix. Export writes all of the
above to one JSON file; import validates the shape and replaces everything.

## 4. Matching and adapters

### Code layout

```
core/         pure TS — no DOM, no chrome.*; model, defaults, matcher, pipeline,
              rule generation, delta merge
sites/        one file per site: SiteAdapter + its Tweaks
entrypoints/  WXT entrypoints: content script, background, popup, options, block page
```

### Matcher (carried over from no-ai-filter, unchanged rules)

- Pure-uppercase keywords of 2–5 letters (`AI`, `LLM`, `KI`) match **case-sensitively**.
- All other plain keywords match case-insensitively.
- Word boundaries are added only on edges that are word characters; an optional trailing
  `s` allows plurals (`LLMs`, `models`).
- `/pattern/flags` entries are raw regexes; the `g` flag is stripped. Invalid regexes are
  rejected at edit time (options UI) and skipped defensively at compile time.
- Compiled **per topic**, so a hit reports which topic and keyword fired.

### Source matching

Exact, case-insensitive comparison on the normalised value of the same `kind`:

- `subreddit` / `channel` / `x-user` / `github-owner`: equal after lowercasing and stripping
  `r/`, `@` prefixes.
- `domain`: item host equals the blocked host or is a subdomain of it
  (`www.the-decoder.de` matches `the-decoder.de`; `notthe-decoder.de` does not).

### Adapter interface

```ts
interface ItemFacts { text: string; sources: SourceRef[] }

interface SiteAdapter {
  id: string;                               // "youtube"
  hosts: string[];                          // matched exactly or as parent domain
  itemSelector: string;
  extract(el: Element): ItemFacts;          // text incl. img alt / aria-label
  related?(el: Element): Element[];         // e.g. HN's subtext + spacer rows
  pageSource?(url: URL): SourceRef | null;  // owner of the current page
}
```

### Pipeline

```ts
interface Verdict { topicId: string; reason: string } // reason e.g. 'keyword "LLM"'
interface Stage { id: string; evaluate(facts: ItemFacts): Verdict | null }
```

- v1 stages, in order: **source** (cheap, exact) → **keyword**. First verdict wins.
- Stages are synchronous in v1. The interface is the extension point for a future async
  classifier stage; no async machinery is built now.
- The compiled pipeline is rebuilt whenever settings, the active profile or any topic
  change.

### Content-script lifecycle

1. Runs at `document_start` on the seven tuned sites (isolated world).
2. Loads settings and compiles the pipeline.
3. If filtering applies on this host, injects a **pre-hide stylesheet** making
   not-yet-evaluated items (`itemSelector` without `data-scrim`) invisible, and injects the
   tweak stylesheet (§5).
4. A `MutationObserver` collects added nodes; evaluation runs once per animation frame on
   the batch.
5. Each item is marked `data-scrim="pass"` or `data-scrim="hit:<topicId>"`; hits get the
   action's CSS class; `related()` elements follow the item.
6. Items whose text is still empty (unhydrated tiles) stay pending and are re-evaluated on
   later mutations.
7. **Failsafe:** any item still pending ~800 ms after it appeared is marked `pass` and shown.
   If the content script throws during setup or evaluation, the pre-hide stylesheet is
   removed. A Scrim bug must never blank a feed.
8. On SPA navigation (URL change without page load), `pageSource` is re-checked; if it
   resolves to a source of an active topic, the page-block overlay (§5) is shown.
9. On settings change: recompile, clear all `data-scrim` marks and classes, re-evaluate.

### Popup ↔ content messaging

- Content script keeps a per-tab log (last 300 hits: snippet, topic, reason) and per-topic
  counts; reports the total to the background for the toolbar badge.
- Popup can request the log and toggle **reveal** (shows all hidden items, outlined).

## 5. Site blocking and tweaks

### Whole-site blocking (background service worker)

- Uses `declarativeNetRequest` **dynamic rules**. On any change to settings, the active
  profile or topics, the worker recomputes the union of `blockSites` over active topics,
  minus `disabledSites`, and replaces its rule set.
- One rule per domain: `main_frame` requests to that domain (including subdomains) are
  redirected to the extension's `block.html`, passing the original URL and topic id.
- Global off clears all rules.
- When a profile switch **newly** blocks a domain, open tabs on that domain are reloaded so
  they land on the block page.
- Rule generation (input: profile, topics, settings → output: rule list) is a pure function
  in `core/`.

### Block page (`block.html`)

- Shows a rotating message (carried over from no-ai-filter's No-work messages, generalised
  with topic and site names), the blocking topic and the active profile.
- **Peek for 5 min**: adds a higher-priority `allow` **session** rule for the domain and a
  `chrome.alarms` alarm that removes it after 5 minutes, then navigates to the original URL.
- **Switch profile**: opens the profile picker (same component as the popup's).

### Page-source blocking (content script)

GitHub, Reddit and YouTube navigate client-side, so redirect rules don't fire. When
`pageSource` resolves to a source in an active topic (a work org page, a blocked
subreddit, a blocked channel), the content script renders the same block view as an
in-page overlay, with the same *Peek for 5 min* behaviour (peek expiry per source stored in
`chrome.storage.session`).

### Tweaks

```ts
interface Tweak {
  id: TweakId;                       // "youtube.hideShorts"
  site: string;                      // SiteAdapter id
  label: string;
  css?: string;
  run?(doc: Document): () => void;   // returns cleanup
}
```

- CSS of all enabled tweaks for the site is injected as a single `<style>` at
  `document_start` — no flash.
- `run` is only for behaviour CSS can't express; its cleanup runs when the tweak is
  disabled or the profile switches.

v1 tweaks:

| Id | Behaviour |
|---|---|
| `youtube.hideShorts` | Hide Shorts shelves, sidebar entry and channel tab; redirect `/shorts/<id>` to `/watch?v=<id>` |
| `youtube.hideHomeRecommendations` | Hide the home-page recommendation grid |
| `youtube.hideWatchRecommendations` | Hide the watch-page sidebar recommendations |
| `youtube.hideEndScreens` | Hide end-screen cards and overlays |
| `youtube.hideComments` | Hide the comments section |
| `youtube.hideExplore` | Hide Explore / Trending navigation |
| `google.hideAiOverview` | Remove Google's AI Overview (known containers + EN/DE heading heuristic from no-ai-filter) |

### Permissions

- `storage`, `tabs`, `alarms`, `declarativeNetRequestWithHostAccess`
- `host_permissions: ["<all_urls>"]` (blocking on any domain)
- Content scripts registered only for the seven tuned sites.

## 6. UI

Svelte 5 via WXT's Svelte integration.

### Popup

- Master on/off.
- Profile switcher.
- "Off on this site" toggle.
- Hidden count for the tab, broken down by topic.
- Reveal toggle.
- Collapsible hidden-items log.
- Link to options.

### Options page (tabs)

- **Profiles** — create / rename / delete; topics (checkboxes), action, tweaks grouped by
  site.
- **Topics** — per topic: keyword editor (shipped vs. user-added entries visually distinct;
  removing a shipped entry records it in `removed`), typed source editor, blocked-sites
  list. Invalid regexes are flagged inline and cannot be saved.
- **Sites** — list of disabled sites.
- **Backup** — export JSON, import JSON, reset to defaults.
- **Keyword tester** — paste text, choose topics (default: all), see which topic and
  keyword would match. Uses `core/` directly.

## 7. Testing

- **Vitest unit tests for `core/`:** matcher (port no-ai-filter's acronym, plural, regex and
  German cases), source normalisation and matching, pipeline ordering, built-in delta merge,
  DNR rule generation, import/export validation.
- **Adapter fixture tests:** saved HTML snapshots per site under
  `tests/fixtures/<site>/*.html`, loaded in happy-dom; assert item count, extracted text,
  extracted sources and `pageSource` per URL. Workflow when a site changes its DOM: save a
  new snapshot → test fails → fix the selector.
- **No E2E automation in v1.** The README contains a short manual checklist for blocking,
  peek and tweaks in a real browser.

## 8. Repository

- Name `scrim`, public on GitHub, MIT license, pnpm.
- GitHub Actions CI: typecheck, ESLint, Vitest, `wxt build`.
- README: what it does, load-unpacked install, development, manual test checklist.
- Hygiene: no personal data (work orgs, domains) in defaults, fixtures or tests. Fixtures
  are captured from public pages only.

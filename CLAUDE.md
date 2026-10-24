# CLAUDE.md — working on Scrim

Scrim is a Chromium MV3 extension (Chrome, Edge, Brave) that hides whole **topics** across feeds (keywords + typed sources), blocks sites per profile via `declarativeNetRequest`, and applies site tweaks (YouTube Shorts/recommendations, Google AI Overview). Built with WXT + TypeScript + Svelte 5. Design: `docs/superpowers/specs/2026-10-17-scrim-design.md`.

## Commands
```bash
pnpm install          # also runs `wxt prepare` (generates .wxt/ types)
pnpm test             # Vitest: unit + adapter fixture tests (happy-dom)
pnpm typecheck        # wxt prepare + tsc + svelte-check
pnpm lint             # ESLint (TS only; .svelte is covered by svelte-check)
pnpm build            # → .output/chrome-mv3 (Load unpacked in chrome://extensions)
pnpm bench            # engine/extraction benchmarks → tests/bench/results.txt (git-ignored)
pnpm run update       # git pull + install + build into the same folder
pnpm dev              # WXT dev mode: launches a browser with hot reload
```
All four of `test`, `typecheck`, `lint`, `build` must pass before a change is done (CI runs the same).

## Layout
| Path | Responsibility |
|---|---|
| `src/core/` | **Pure** logic, no DOM, no `browser.*`: model, keyword matcher, pipeline (source → keyword stages), topics + shipped defaults (`defaults/`), store over a `KV` interface, DNR rule generation, validation |
| `src/core/defaults/` | One file per built-in topic (keywords + default subreddit sources); `index.ts` registers topics and default profiles |
| `src/sites/` | One `SiteAdapter` per tuned site (+ its `Tweak`s); `index.ts` is the registry and the content-script match patterns |
| `src/content/` | DOM engine (incremental scanning, fingerprints, fail-open), actions (hide/blur/collapse), tweak manager, page-block overlay, controller (glue) |
| `src/background/` | DNR redirect rules for blocked sites, peeks (session allow rules + alarms), badge |
| `src/platform/` | `browser.storage` KV, session peeks, runtime message types |
| `src/entrypoints/` | WXT entry points: `background.ts`, `content.ts`, `popup/`, `options/`, `block/` (Svelte 5) |
| `tests/` | mirrors `src/`; `fixtures/<site>/*.html` are saved DOM snapshots for adapter tests; `bench/` runs only via `pnpm bench` |

## Conventions and gotchas
- **Fail open.** A Scrim error must never leave a feed blank. The pre-hide stylesheet hides only items without `data-scrim`; the engine marks every item `pass` or `hit:<topic>`, with an 800 ms failsafe and per-item try/catch. Keep it that way in any engine/adapter change, with a test.
- **No full-document work per animation frame.** The engine only looks at added subtrees, changed items and pending shells; a safety scan runs at most every 2 s. Check hot-path changes with `pnpm bench` before/after.
- **Precision over recall in shipped lists.** Every keyword list has match **and** miss tests (`tests/core/defaults.test.ts`). Ambiguous words stay out; shouting-caps or name patterns use case-sensitive raw regexes (`'/\\bTrump\\b/'`). All-caps 2–5-letter keywords are case-sensitive automatically.
- **Built-in topics are stored as user deltas** (added/removed), so shipped list changes reach existing users. Don't persist full copies of defaults.
- **GitHub is source-only** (`sourcesOnly: true`): never keyword-filter it.
- **TypeScript:** `noUncheckedIndexedAccess` is on (from WXT's tsconfig); TypeScript is pinned to `~6` (svelte-check doesn't support 7). Relative imports only (no `@/` alias; Vitest doesn't know it).
- **Svelte 5:** state handed to storage comes from `$state.raw` (plain objects). Don't name a prop `state` in a component that uses the `$state` rune.
- **Tests:** files that touch the DOM start with `// @vitest-environment happy-dom`. Load fixtures with `loadFixture('<site>/<file>.html')` (`tests/helpers/fixture.ts`). happy-dom has no layout (`offsetHeight` is 0).
- **No personal data in the repo:** no real work orgs, internal domains or personal sources in defaults, fixtures, tests or docs. Users keep those in their own (exported) settings.
- **Docs:** update `README.md` (topic table, usage) and this file when behaviour, topics, commands or layout change.

## Workflow
- Feature work: issue → branch → PR (`Closes #N`); small docs/tuning may go straight to `main` when the maintainer agrees.
- Commits: conventional style (`feat:`, `fix:`, `perf:`, `docs:`, `chore:`), one logical change per commit.
- Recurring tasks have project skills in `.claude/skills/`: `add-site-adapter` (new site or broken selector) and `tune-topics` (a miss, a false positive, or a new topic).

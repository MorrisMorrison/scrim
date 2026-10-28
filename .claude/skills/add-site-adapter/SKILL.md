---
name: add-site-adapter
description: Add a new tuned site to Scrim, or fix an adapter whose selectors broke because a site changed its markup (items no longer hidden, wrong text/sources extracted, page-source block not firing). Use when the user says a site isn't filtered at all, a site "stopped working", or wants support for a new site.
---

# Add or fix a site adapter

Adapters live in `src/sites/<site>.ts` and implement `SiteAdapter` (`src/sites/types.ts`):
`id`, `label`, `hosts`, `itemSelector`, `extract(el) → { text, sources }`, optional `appliesTo(host)`, `sourcesOnly`, `related(el)`, `pageSource(url)`, `expectsItems(url)`.

The popup health check ("Scrim found no feed items here") is often the first sign a selector broke; the user can paste its **Copy diagnostics** JSON (adapter, path, counts, selector).

## Fixing a broken selector
1. **Get a real snapshot.** Ask the user to open the page, select the feed container in DevTools and run `copy($0.outerHTML)`. Save it as `tests/fixtures/<site>/<page>-live.html`. **Strip usernames and anything personal**: only public content stays.
2. **Write the failing test** in `tests/sites/<site>.test.ts` (first line `// @vitest-environment happy-dom`):
   - `loadFixture('<site>/<page>-live.html')`;
   - assert `document.querySelectorAll(<adapter>.itemSelector).length` is greater than 0;
   - assert that `extract()` on the first item returns non-empty text and the expected sources.
3. Run `pnpm test tests/sites/<site>.test.ts` and see it fail.
4. Fix `itemSelector` / `extract` / `pageSource`. Prefer stable hooks (custom element names, `data-testid`, ARIA, URL patterns) over hashed class names.
5. `pnpm test`, then rebuild (`pnpm build`) for the user to reload and re-check live.

## Adding a new site
1. **Adapter:** create `src/sites/<site>.ts`.
   - Use `richText(el)` for text. It reads text nodes, `img[alt]` and link/media aria-labels, and skips control labels.
   - Use `linkDomains(el)` for external domains.
   - Add typed sources (`subreddit`, `channel`, `x-user`, `github-owner`, `domain`), deduped with `dedupeSources`.
   - Use `related(el)` if one item spans several sibling elements (as on Hacker News).
2. **Health:** add `expectsItems(url)` returning true only on feed pages (never on settings, item/detail or tab views with other layouts), and cover it in `tests/sites/index.test.ts`.
3. **Register it** in `src/sites/index.ts`: add it to `ADAPTERS`, plus a match pattern in `CONTENT_MATCHES`. `*://*.example.com/*` also matches the bare domain. If two adapters share a parent domain, add `appliesTo`.
4. **Fixture + tests:** a minimal hand-written fixture mirroring the real DOM structure the selectors rely on, plus tests for item selection, `extract` (text and sources), `related` and `pageSource`. Extend `tests/sites/index.test.ts` routing.
5. **Tweaks (optional):** CSS-first `Tweak`s next to the adapter, registered in `TWEAKS`. A `run()` must return a cleanup function and must not do document-wide work per frame: watch added subtrees only.
6. **Docs:** add the site to "Tuned sites" in `README.md` and to `CLAUDE.md` if layout or conventions changed.

## Verify
- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` all pass.
- If the adapter runs on busy pages, `pnpm bench` shows no full-document queries per frame.
- Live check by the user: load `.output/chrome-mv3` (or **Reload Scrim**), open the site, and confirm that hidden items have `data-scrim="hit:<topic>"` and nothing stays blank.

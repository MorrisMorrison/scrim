# Scrim

A Chromium extension (Chrome, Edge, Brave) that hides whole **topics** across feeds,
blocks sites per profile, and tames YouTube. It's the successor to
[no-ai-filter](https://github.com/MorrisMorrison/no-ai-filter).

- **Topics:** AI, Software/IT, Work, NSFW, or your own. Each has keywords (plain or `/regex/flags`),
  typed sources (`r/sub`, `yt:@channel`, `x:@user`, `gh:owner`, domains) and sites to block outright.
- **Profiles:** named bundles of topics, an action (hide, blur, collapse) and site tweaks. Switch from the popup.
  Ships with **Default** (AI) and **Downtime** (AI + Work + Software/IT + YouTube tweaks).
- **Site blocking:** while a topic is active, its blocked sites redirect to a reminder page
  before they load. **Peek for 5 min** if you must.
- **Tweaks:** hide YouTube Shorts, recommendations, end screens, comments and Explore; hide Google's AI Overview.
- **Tuned sites:** Reddit, YouTube, X/Twitter, Hacker News, Google Search, Google News, GitHub.
- Everything stays in your browser (`chrome.storage.local`). Export/import JSON for backups.

## Install

Scrim isn't on any store. Build it and load it unpacked:

```bash
pnpm install
pnpm build
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `.output/chrome-mv3`.

## Develop

```bash
pnpm dev         # Chrome with hot reload
pnpm test        # unit + adapter fixture tests
pnpm typecheck
pnpm lint
```

Layout: `src/core` (pure logic, no DOM), `src/sites` (one adapter + tweaks per site),
`src/content` (DOM engine), `src/background` (blocking, badge), `src/entrypoints` (WXT entry points and UI).

## When a site breaks

Sites change their markup. Save the page's feed container
(`copy($0.outerHTML)` in DevTools), add it under `tests/fixtures/<site>/`, write a failing
test in `tests/sites/<site>.test.ts`, then fix the selector in `src/sites/<site>.ts`.

## Manual test checklist

- [ ] Each tuned site hides AI items with the Default profile; the popup count and badge match.
- [ ] Reveal mode outlines hidden items; turning it off hides them again.
- [ ] Downtime: Hacker News redirects to the block page; Peek for 5 min works and expires.
- [ ] Downtime: YouTube Shorts, home and watch-page recommendations are hidden; `/shorts/<id>` opens in the player.
- [ ] A `gh:<org>` Work source overlays that org's pages in Downtime.
- [ ] Google's AI Overview is gone.
- [ ] "Off on this site" and the master switch turn everything off immediately.
- [ ] Export, reset and import restore custom topics and profiles.

## License

MIT

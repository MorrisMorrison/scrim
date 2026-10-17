# Scrim

A Chromium extension (Chrome, Edge, Brave) that hides whole **topics** across feeds,
blocks sites per profile, and tames YouTube. It's the successor to
[no-ai-filter](https://github.com/MorrisMorrison/no-ai-filter).

- **Topics:** AI, Software/IT, Work, Politics, NSFW, or your own.
- **Profiles:** named bundles of topics, an action and site tweaks. Switch from the popup.
- **Site blocking:** while a topic is active, its blocked sites redirect to a reminder page
  before they load. **Peek for 5 min** if you must.
- **Tweaks:** hide YouTube Shorts, recommendations, end screens, comments and Explore; hide Google's AI Overview.
- **Tuned sites:** Reddit, YouTube, X/Twitter, Hacker News, Google Search, Google News, GitHub.
- Everything stays in your browser (`chrome.storage.local`). Nothing is sent anywhere.

## Install

Scrim isn't on any store. Build it and load it unpacked:

```bash
pnpm install
pnpm build
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `.output/chrome-mv3`.

### Update

```bash
pnpm run update   # git pull + install + build into the same .output/chrome-mv3
```

Then click **Reload Scrim** in the popup. Your settings are kept, because an unpacked extension keeps its ID and
storage as long as you load it from the same folder.

## Using it

**Popup** (toolbar icon):
- master switch and profile switcher
- "Off on this site"
- how many items were hidden on the page, by topic
- **Reveal hidden items**, which outlines what was hidden instead of removing it
- a log of what was hidden and why

**Options:**
- **Profiles:** which topics are on, what happens to matches, and site tweaks.
  - What happens to matches: **hide**, **blur** (click to reveal) or **collapse** to a small bar.
- **Topics:** each topic has three lists. Shipped entries are marked *default*; removing one only hides it for you.
  - **Keywords:** plain words or phrases, or `/regex/flags`.
    - All-caps words of 2–5 letters (`AI`, `LLM`, `KI`) match case-sensitively, so "email" never hits "AI".
    - Everything else matches case-insensitively, as whole words, with an optional plural *s*.
  - **Sources:** hide everything from a source, whatever the wording:
    - `r/subreddit`
    - `yt:@channel`
    - `x:@user`
    - `gh:owner` (a GitHub user or org)
    - a link domain such as `example.com`
    - On a blocked source's own page (a subreddit, channel, profile or GitHub org), the whole page is covered.
  - **Blocked sites:** domains that redirect to the block page while the topic is active.
- **Sites:** domains where Scrim does nothing at all.
- **Backup:** export or import everything as JSON, or reset to the defaults.
- **Keyword tester:** paste a headline to see which topic and keyword would hide it.

### Shipped topics and profiles

| Topic | What it catches |
|---|---|
| AI | AI/LLM terms in English and German, AI products and vendors, AI subreddits (e.g. r/singularity, r/accelerate) |
| Software/IT | programming terms, languages and tools, dev subreddits; blocks Hacker News |
| Work | job, career and office terms in English and German, work subreddits (e.g. r/LinkedInLunatics, r/antiwork) |
| Politics | political terms, parties and politicians (EN/DE), political subreddits |
| Crypto & markets | crypto, coins, trading and stock-market chatter (EN/DE), r/wallstreetbets, r/CryptoCurrency and similar |
| Hustle & self-improvement | side hustles, passive income, grindset and guru phrases, r/sidehustle, r/Entrepreneur and similar |
| Ragebait & clickbait | clickbait phrases and SHOUTING headlines ("DESTROYS", "SHOCKING"), freakout subreddits |
| Doomscroll news | war, attacks and disasters (EN/DE), r/worldnews, r/news, war-footage subreddits |
| Celebrity & gossip | celebrities, red carpets, reality TV, influencer drama, Promis, r/Fauxmoi and similar |
| Spoilers | a template: generic spoiler markers ("ending explained", "season finale"). Add the shows, games or teams you're catching up on as keywords |
| NSFW | a small set of explicit terms |

The **Default** profile hides AI. **Downtime** hides AI, Work and Software/IT and tames YouTube.
The other topics ship turned off; switch them on in a profile.

### Personal settings

Your own work orgs, internal domains and extra sources belong in your browser's storage, not in this repo.
To keep them across machines, export from **Options → Backup** and store the file somewhere private
(e.g. a private git repo). Import it on a new install. Importing **replaces** all settings.

## Develop

```bash
pnpm dev         # Chrome with hot reload
pnpm test        # unit + adapter fixture tests
pnpm typecheck
pnpm lint
```

Layout:
- `src/core`: pure logic, no DOM
- `src/sites`: one adapter plus its tweaks per site
- `src/content`: DOM engine
- `src/background`: blocking, badge
- `src/entrypoints`: WXT entry points and UI

## When a site breaks

Sites change their markup.
1. Save the page's feed container with `copy($0.outerHTML)` in DevTools.
2. Add it under `tests/fixtures/<site>/`.
3. Write a failing test in `tests/sites/<site>.test.ts`.
4. Fix the selector in `src/sites/<site>.ts`.

## License

MIT

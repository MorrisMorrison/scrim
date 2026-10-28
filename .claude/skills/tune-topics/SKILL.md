---
name: tune-topics
description: Tune Scrim's shipped topics. Use when something slipped through ("this post should have been hidden"), something was hidden wrongly (false positive), or when adding a new built-in topic or default subreddits/channels. Covers choosing source vs keyword, the defaults files, the match/miss tests and the README table.
---

# Tune or add a topic

Built-in topics live in `src/core/defaults/<topic>.ts` (keywords + default subreddit sources) and are registered in `src/core/defaults/index.ts`. The topic id is part of the `BuiltinTopicId` union in `src/core/model.ts`. User changes to built-ins are stored as deltas, so shipped changes reach existing users automatically.

## 1. Diagnose before changing anything
For a miss, find out why it slipped through:
- **No text to match:** an image-only post, or the title is just a name. Use a **source** (the subreddit or channel) instead of a keyword.
- **Wording not covered:** add a keyword only if it's unambiguous. Check common collisions ("rust" vs Rust, "war" vs Star Wars, "trump card").
- **Wrong site extraction:** that's an adapter problem. Use the `add-site-adapter` skill.

For a false positive, the user can often fix it in one click: popup log → **Always show [source]** / **Stop hiding "keyword"**, or right-click → Scrim → Always show. Shipped-list changes are still worth it when the keyword misfires for everyone. Find the keyword that fired (the popup log shows `keyword "…"`; Options → Keyword tester reproduces it). Then narrow it: remove it, make it a phrase, or make it a case-sensitive raw regex (`'/\\bWord\\b/'`).

Decide **generic vs personal**:
- **Generic** entries belong in the shipped defaults.
- **Personal** entries (a user's work org, a favourite creator to hide) belong in the user's own settings, not in the repo.

## 2. Test first
In `tests/core/defaults.test.ts`:
- **Keywords:** add the missed text to the topic's `matches` list and an everyday look-alike to its `misses` list (`topicCases`).
- **Sources:** add a `topicOf('<subreddit>')` expectation in "route well-known subreddits".
- **New topic:** add its id to the expected `BUILTIN_TOPIC_IDS` order. Update the `allTopics` order in `tests/core/store.test.ts`.

Run `pnpm test tests/core` and see the new cases fail.

## 3. Change the defaults
- Edit `src/core/defaults/<topic>.ts`, or create it for a new topic, exporting `<TOPIC>_KEYWORDS` and optionally `<TOPIC>_SOURCES` via `subreddits(...)`.
- **New topic only:**
  - extend `BuiltinTopicId`;
  - add the id to `BUILTIN_TOPIC_IDS`, before `nsfw`;
  - add the entry to `BUILTIN_TOPICS`, with a human `name`.
  - New topics ship **off**: don't add them to `DEFAULT_PROFILES` unless asked.
- **Matcher rules to remember:**
  - all-caps 2–5-letter entries are case-sensitive;
  - whole-word matching with an optional plural `s`;
  - `/pattern/flags` entries are raw regexes (`g`/`y` are stripped).
  - Write regex entries with the file-editing tools, not through a shell heredoc, which can eat backslashes.
  - Never add duplicates (the test checks).

## 4. Verify and document
- `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.
- For a new topic, add a row to the "Shipped topics and profiles" table in `README.md`, plus a line under "Topics" if useful.
- The user picks it up with `pnpm run update` and **Reload Scrim**. New topics are ticked per profile under Options → Profiles.

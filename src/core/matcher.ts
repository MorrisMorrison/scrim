// Keyword compilation + text matching. Rules carried over from no-ai-filter:
// - 2–5 letter all-caps entries (AI, LLM, KI) match case-sensitively, so "email" never hits.
// - Everything else matches case-insensitively.
// - Word boundaries only on edges that are word chars; an optional plural "s" is allowed,
//   so "LLM" matches "LLMs" while "Sora" still won't match "Soraya".
// - "/pattern/flags" entries are raw regexes; stateful g/y flags are stripped.

export interface CompiledKeywords {
  cs: RegExp | null;
  ci: RegExp | null;
  rx: RegExp[];
  // The configured entries behind each regex (rxEntries[i] belongs to rx[i]), so a match can
  // name the keyword the user would remove ("LLM", not the matched "LLMs").
  csEntries: string[];
  ciEntries: string[];
  rxEntries: string[];
}

export interface KeywordMatch {
  text: string; // what matched in the item ("LLMs")
  keyword: string; // the configured entry ("LLM", "/gpt-?[0-9]/i")
}

const RAW_REGEX = /^\/(.+)\/([a-z]*)$/i;

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isAcronym(kw: string): boolean {
  return /^[A-Z]{2,5}$/.test(kw);
}

export function keywordPattern(kw: string): string {
  const left = /^\w/.test(kw) ? '\\b' : '';
  const right = /\w$/.test(kw) ? 's?\\b' : '';
  return left + escapeRegExp(kw) + right;
}

function rawRegex(kw: string): RegExp | null {
  const m = RAW_REGEX.exec(kw);
  if (!m) return null;
  try {
    return new RegExp(m[1] ?? '', (m[2] ?? '').replace(/[gy]/g, ''));
  } catch {
    return null;
  }
}

export function validateKeyword(input: string): string | null {
  const kw = input.trim();
  if (!kw) return 'Keyword is empty';
  const m = RAW_REGEX.exec(kw);
  if (!m) return null;
  try {
    new RegExp(m[1] ?? '', (m[2] ?? '').replace(/[gy]/g, ''));
    return null;
  } catch (e) {
    return `Invalid regex: ${(e as Error).message}`;
  }
}

function build(list: string[], flags: string): RegExp | null {
  return list.length ? new RegExp(list.map(keywordPattern).join('|'), flags) : null;
}

export function compileKeywords(keywords: readonly string[]): CompiledKeywords {
  const cs: string[] = [];
  const ci: string[] = [];
  const rx: RegExp[] = [];
  const rxEntries: string[] = [];
  for (const raw of keywords) {
    const kw = raw.trim();
    if (!kw) continue;
    if (RAW_REGEX.test(kw)) {
      const r = rawRegex(kw);
      if (r) {
        rx.push(r);
        rxEntries.push(kw);
      }
      continue;
    }
    (isAcronym(kw) ? cs : ci).push(kw);
  }
  return { cs: build(cs, ''), ci: build(ci, 'i'), rx, csEntries: cs, ciEntries: ci, rxEntries };
}

// Which entry of a combined regex produced this matched text. Only runs on a hit.
function entryFor(matched: string, entries: string[], flags: string): string {
  return (
    entries.find((kw) => new RegExp(`^(?:${keywordPattern(kw)})$`, flags).test(matched)) ?? matched
  );
}

export function matchEntry(
  text: string | null | undefined,
  compiled: CompiledKeywords,
): KeywordMatch | null {
  if (!text) return null;
  // Hot path (every item, every topic): no allocations until something matches.
  let m = compiled.cs?.exec(text);
  if (m) return { text: m[0], keyword: entryFor(m[0], compiled.csEntries, '') };
  m = compiled.ci?.exec(text);
  if (m) return { text: m[0], keyword: entryFor(m[0], compiled.ciEntries, 'i') };
  for (let i = 0; i < compiled.rx.length; i++) {
    m = compiled.rx[i]?.exec(text);
    if (m) return { text: m[0], keyword: compiled.rxEntries[i] ?? m[0] };
  }
  return null;
}

export function firstMatch(
  text: string | null | undefined,
  compiled: CompiledKeywords,
): string | null {
  return matchEntry(text, compiled)?.text ?? null;
}

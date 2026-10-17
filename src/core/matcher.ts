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
  for (const raw of keywords) {
    const kw = raw.trim();
    if (!kw) continue;
    if (RAW_REGEX.test(kw)) {
      const r = rawRegex(kw);
      if (r) rx.push(r);
      continue;
    }
    (isAcronym(kw) ? cs : ci).push(kw);
  }
  return { cs: build(cs, ''), ci: build(ci, 'i'), rx };
}

export function firstMatch(
  text: string | null | undefined,
  compiled: CompiledKeywords,
): string | null {
  if (!text) return null;
  for (const r of [compiled.cs, compiled.ci, ...compiled.rx]) {
    if (!r) continue;
    const m = r.exec(text);
    if (m) return m[0];
  }
  return null;
}

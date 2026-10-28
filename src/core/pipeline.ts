// Ordered matching stages. v1 has two synchronous stages: sources (cheap, exact) then
// keywords. The Stage interface is where a future async classifier would plug in. Before any
// stage, the user's "Never hide" allowlist gets the last word: an item from an allowed source
// is never hidden.
import { normalizedHostMatches, normalizeHost } from './host';
import { compileKeywords, matchEntry } from './matcher';
import type { ItemFacts, SourceRef, Stage, Topic, Verdict } from './model';
import { formatSource, sourceKey } from './sources';

// An item source normalized once, then probed against every topic (and the allowlist).
type Probe = { key: string; host: null } | { key: null; host: string };

function probe(src: SourceRef): Probe {
  return src.kind === 'domain' ? { key: null, host: normalizeHost(src.host) } : { key: sourceKey(src), host: null };
}

// A set of sources with exact matching (domains also cover their subdomains), normalized once.
interface SourceSet {
  has(p: Probe): boolean;
}

function compileSources(sources: readonly SourceRef[]): SourceSet {
  const keys = new Set(sources.filter((s) => s.kind !== 'domain').map(sourceKey));
  const domains = sources.flatMap((s) => (s.kind === 'domain' ? [normalizeHost(s.host)] : []));
  return {
    has(p) {
      if (p.key !== null) return keys.has(p.key);
      const host = p.host;
      return domains.some((d) => normalizedHostMatches(host, d));
    },
  };
}

export function sourceStage(topics: readonly Topic[]): Stage {
  const compiled = topics.map((t) => ({ id: t.id, sources: compileSources(t.sources) }));
  return {
    id: 'source',
    evaluate(facts) {
      for (const src of facts.sources) {
        const p = probe(src);
        for (const t of compiled) {
          if (t.sources.has(p)) {
            return { topicId: t.id, reason: `source ${formatSource(src)}`, match: { kind: 'source', source: src } };
          }
        }
      }
      return null;
    },
  };
}

export function keywordStage(topics: readonly Topic[]): Stage {
  const compiled = topics.map((t) => ({ id: t.id, keywords: compileKeywords(t.keywords) }));
  return {
    id: 'keyword',
    evaluate(facts) {
      if (!facts.text) return null;
      for (const t of compiled) {
        const m = matchEntry(facts.text, t.keywords);
        if (m) {
          return {
            topicId: t.id,
            reason: `keyword "${m.text}"`,
            match: { kind: 'keyword', keyword: m.keyword, text: m.text },
          };
        }
      }
      return null;
    },
  };
}

export interface Pipeline {
  readonly empty: boolean;
  evaluate(facts: ItemFacts): Verdict | null;
}

export function buildPipeline(topics: readonly Topic[], allow: readonly SourceRef[] = []): Pipeline {
  const stages = [sourceStage(topics), keywordStage(topics)];
  const allowed = compileSources(allow);
  return {
    empty: topics.length === 0,
    evaluate(facts) {
      if (allow.length > 0 && facts.sources.some((s) => allowed.has(probe(s)))) return null;
      for (const stage of stages) {
        const verdict = stage.evaluate(facts);
        if (verdict) return verdict;
      }
      return null;
    },
  };
}

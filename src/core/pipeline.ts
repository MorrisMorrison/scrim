// Ordered matching stages. v1 has two synchronous stages: sources (cheap, exact) then
// keywords. The Stage interface is where a future async classifier would plug in.
import { hostMatches } from './host';
import { compileKeywords, firstMatch } from './matcher';
import type { ItemFacts, Stage, Topic, Verdict } from './model';
import { formatSource, sourceKey } from './sources';

export function sourceStage(topics: readonly Topic[]): Stage {
  const compiled = topics.map((t) => ({
    id: t.id,
    keys: new Set(t.sources.filter((s) => s.kind !== 'domain').map(sourceKey)),
    domains: t.sources.flatMap((s) => (s.kind === 'domain' ? [s.host] : [])),
  }));
  return {
    id: 'source',
    evaluate(facts) {
      for (const src of facts.sources) {
        for (const t of compiled) {
          const hit =
            src.kind === 'domain'
              ? t.domains.some((d) => hostMatches(src.host, d))
              : t.keys.has(sourceKey(src));
          if (hit) return { topicId: t.id, reason: `source ${formatSource(src)}` };
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
        const m = firstMatch(facts.text, t.keywords);
        if (m) return { topicId: t.id, reason: `keyword "${m}"` };
      }
      return null;
    },
  };
}

export interface Pipeline {
  readonly empty: boolean;
  evaluate(facts: ItemFacts): Verdict | null;
}

export function buildPipeline(topics: readonly Topic[]): Pipeline {
  const stages = [sourceStage(topics), keywordStage(topics)];
  return {
    empty: topics.length === 0,
    evaluate(facts) {
      for (const stage of stages) {
        const verdict = stage.evaluate(facts);
        if (verdict) return verdict;
      }
      return null;
    },
  };
}

// In-page feedback: which source a right-click on a post refers to.
import type { SourceRef } from '../core/model';
import { pickSource } from '../core/sources';
import type { SiteAdapter } from '../sites/types';

export type FeedbackSource = { ok: true; source: SourceRef } | { ok: false; message: string };

// `target` is the element under the cursor when the context menu opened.
export function resolveFeedbackSource(target: Element | null, adapter: SiteAdapter): FeedbackSource {
  const item = target?.closest(adapter.itemSelector);
  if (!item) return { ok: false, message: 'Right-click a post to use Scrim here.' };
  let sources: SourceRef[];
  try {
    sources = adapter.extract(item).sources;
  } catch {
    return { ok: false, message: "Scrim couldn't read this post." };
  }
  const source = pickSource(sources);
  return source ? { ok: true, source } : { ok: false, message: "Scrim couldn't find a source for this post." };
}

// Typed source references: who/where an item comes from. Matching is exact on the
// normalised value (never substring) so "r/AI" can't also block "r/AIArt".
import { normalizeHost } from './host';
import type { SourceRef } from './model';

export function sourceValue(ref: SourceRef): string {
  switch (ref.kind) {
    case 'subreddit':
      return ref.name;
    case 'channel':
    case 'x-user':
      return ref.handle;
    case 'domain':
      return ref.host;
    case 'github-owner':
      return ref.owner;
  }
}

export function normalizeSource(ref: SourceRef): SourceRef {
  switch (ref.kind) {
    case 'subreddit':
      return { kind: 'subreddit', name: ref.name.trim().replace(/^\/?r\//i, '').toLowerCase() };
    case 'channel':
      return { kind: 'channel', handle: ref.handle.trim().replace(/^@/, '').toLowerCase() };
    case 'x-user':
      return { kind: 'x-user', handle: ref.handle.trim().replace(/^@/, '').toLowerCase() };
    case 'domain':
      return { kind: 'domain', host: normalizeHost(ref.host) };
    case 'github-owner':
      return { kind: 'github-owner', owner: ref.owner.trim().toLowerCase() };
  }
}

export function sourceKey(ref: SourceRef): string {
  const n = normalizeSource(ref);
  return `${n.kind}:${sourceValue(n)}`;
}

// Display notation, also accepted by parseSource: r/name, yt:@handle, x:@handle,
// gh:owner, or a bare domain.
export function formatSource(ref: SourceRef): string {
  switch (ref.kind) {
    case 'subreddit':
      return `r/${ref.name}`;
    case 'channel':
      return `yt:@${ref.handle}`;
    case 'x-user':
      return `x:@${ref.handle}`;
    case 'domain':
      return ref.host;
    case 'github-owner':
      return `gh:${ref.owner}`;
  }
}

export function parseSource(input: string): SourceRef | null {
  const s = input.trim();
  let m: RegExpExecArray | null;
  if ((m = /^\/?r\/([A-Za-z0-9_]+)\/?$/.exec(s))) return { kind: 'subreddit', name: m[1] ?? '' };
  if ((m = /^yt:@?([\w.-]+)$/i.exec(s))) return { kind: 'channel', handle: m[1] ?? '' };
  if ((m = /^x:@?(\w+)$/i.exec(s))) return { kind: 'x-user', handle: m[1] ?? '' };
  if ((m = /^gh:([A-Za-z0-9-]+)$/i.exec(s))) return { kind: 'github-owner', owner: m[1] ?? '' };
  if ((m = /^(?:domain:)?((?:[a-z0-9-]+\.)+[a-z]{2,})$/i.exec(s))) {
    return { kind: 'domain', host: (m[1] ?? '').toLowerCase() };
  }
  return null;
}

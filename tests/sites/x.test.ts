// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { x } from '../../src/sites/x';
import { loadFixture } from '../helpers/fixture';

const byId = (id: string) => document.getElementById(id) as Element;

describe('x adapter', () => {
  beforeEach(() => loadFixture('x/timeline.html'));

  it('selects tweets', () => {
    expect(document.querySelectorAll(x.itemSelector)).toHaveLength(2);
  });

  it('extracts the author handle and link domains', () => {
    const facts = x.extract(byId('ai-tweet'));
    expect(facts.text).toContain('GPT-5 is here');
    expect(facts.sources).toEqual([
      { kind: 'domain', host: 't.co' },
      { kind: 'x-user', handle: 'sama' },
    ]);
  });

  it('ignores reserved routes', () => {
    expect(x.extract(byId('garden-tweet')).sources).toEqual([{ kind: 'x-user', handle: 'gardener' }]);
  });

  it("ignores the Grok button's aria-label (an AI keyword on every tweet)", () => {
    const facts = x.extract(byId('garden-tweet'));
    expect(facts.text).toContain('Tomatoes are ripe');
    expect(facts.text).not.toContain('Grok');
  });

  it('knows the user that owns a page', () => {
    expect(x.pageSource?.(new URL('https://x.com/sama'))).toEqual({ kind: 'x-user', handle: 'sama' });
    expect(x.pageSource?.(new URL('https://x.com/sama/status/1'))).toEqual({ kind: 'x-user', handle: 'sama' });
    expect(x.pageSource?.(new URL('https://x.com/home'))).toBeNull();
  });
});

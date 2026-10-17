// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { hackerNews } from '../../src/sites/hackernews';
import { loadFixture } from '../helpers/fixture';

describe('hacker news adapter', () => {
  beforeEach(() => loadFixture('hackernews/front.html'));

  it('selects one item per story', () => {
    expect(document.querySelectorAll(hackerNews.itemSelector)).toHaveLength(2);
  });

  it('extracts title + subtext text and the site domain', () => {
    const first = document.querySelector(hackerNews.itemSelector) as Element;
    const facts = hackerNews.extract(first);
    expect(facts.text).toContain('OpenAI ships a new model');
    expect(facts.text).toContain('100 points');
    expect(facts.sources).toEqual([{ kind: 'domain', host: 'openai.com' }]);
  });

  it('hides the subtext and spacer rows with the story', () => {
    const first = document.querySelector(hackerNews.itemSelector) as Element;
    const related = hackerNews.related?.(first) ?? [];
    expect(related).toHaveLength(2);
    // Length is asserted above, so both indexes are present (noUncheckedIndexedAccess).
    expect((related[0] as Element).querySelector('.subtext')).not.toBeNull();
    expect((related[1] as Element).classList.contains('spacer')).toBe(true);
  });
});

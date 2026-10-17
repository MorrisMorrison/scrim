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

describe('hacker news item page', () => {
  beforeEach(() => loadFixture('hackernews/item.html'));

  it('treats only the story as an item, never comments', () => {
    const items = [...document.querySelectorAll(hackerNews.itemSelector)];
    expect(items.map((el) => el.id)).toEqual(['10']);
  });

  it('never reads or hides a comment along with an item', () => {
    for (const item of document.querySelectorAll(hackerNews.itemSelector)) {
      expect(hackerNews.extract(item).text).not.toContain('LLM');
      const related = hackerNews.related?.(item) ?? [];
      expect(related.some((el) => el.classList.contains('comtr'))).toBe(false);
    }
  });

  it('does not take a following .athing row as subtext', () => {
    document.body.innerHTML =
      '<table><tbody>' +
      '<tr class="athing submission" id="s"><td class="title">Sourdough</td></tr>' +
      '<tr class="athing comtr" id="c"><td>An LLM wrote this comment</td></tr>' +
      '</tbody></table>';
    const story = document.getElementById('s') as Element;
    expect(hackerNews.extract(story).text).toBe('Sourdough');
    expect(hackerNews.related?.(story)).toEqual([]);
  });
});

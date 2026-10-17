// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { linkDomains, richText } from '../../src/sites/dom';

function item(html: string): Element {
  document.body.innerHTML = `<div id="item">${html}</div>`;
  return document.getElementById('item') as Element;
}

describe('richText', () => {
  it('reads text without innerText (empty for pre-hidden items in Blink)', () => {
    const el = item('<p>an LLM post</p>');
    // Blink returns "" from innerText under visibility:hidden, which the pre-hide CSS sets.
    Object.defineProperty(el, 'innerText', { get: () => '' });
    expect(richText(el)).toBe('an LLM post');
  });

  it('separates elements with single spaces and skips script/style', () => {
    const el = item(
      '<div>Title</div><div>by   author\n\n </div><script>var LLM = 1;</script><style>.ai{}</style><span>3h</span>',
    );
    expect(richText(el)).toBe('Title by author 3h');
  });

  it('includes image alt text', () => {
    expect(richText(item('<p>hello</p><img src="x.png" alt="Banner about LLM agents">'))).toContain(
      'Banner about LLM agents',
    );
  });

  it('includes aria-labels of links and media', () => {
    const text = richText(
      item(
        '<a href="/p" aria-label="Read: Copilot everywhere"></a>' +
          '<video aria-label="Clip of a robot"></video>' +
          '<svg aria-label="Chart of tokens"></svg>',
      ),
    );
    expect(text).toContain('Read: Copilot everywhere');
    expect(text).toContain('Clip of a robot');
    expect(text).toContain('Chart of tokens');
  });

  it('ignores aria-labels of buttons, role=button, menus and anything inside them', () => {
    const text = richText(
      item(
        '<p>Tomatoes are ripe</p>' +
          '<button aria-label="Grok actions"><svg aria-label="Grok icon"></svg></button>' +
          '<div role="button" aria-label="Ask Gemini"><img alt="Gemini logo"></div>' +
          '<a href="/x" role="button" aria-label="Summarize with AI"></a>' +
          '<div role="menuitem" aria-label="Explain this post with Copilot"></div>' +
          '<div role="menu"><a href="/y" aria-label="Open in ChatGPT"></a></div>',
      ),
    );
    expect(text).toContain('Tomatoes are ripe');
    for (const word of ['Grok', 'Gemini', 'Summarize', 'Copilot', 'ChatGPT']) expect(text).not.toContain(word);
  });
});

describe('linkDomains', () => {
  it('keeps external domains, ignores same-site and malformed links, and dedupes', () => {
    const sources = linkDomains(
      item(
        `<a href="/local">local</a>` +
          `<a href="${location.origin}/abs">same site</a>` +
          `<a href="https://www.OpenAI.com/blog">ext</a>` +
          `<a href="https://openai.com/other">dup</a>` +
          `<a href="http://[broken">bad</a>` +
          `<a href="https://example.org/">ext 2</a>`,
      ),
    );
    expect(sources).toEqual([
      { kind: 'domain', host: 'openai.com' },
      { kind: 'domain', host: 'example.org' },
    ]);
  });
});

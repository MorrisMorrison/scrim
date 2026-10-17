// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { prehideCss, setStyle } from '../../src/content/styles';

describe('prehideCss', () => {
  it('hides only unevaluated items, and never in reveal mode', () => {
    expect(prehideCss('article, .x')).toBe(
      'html:not(.scrim-reveal) :is(article, .x):not([data-scrim]) { visibility: hidden !important; }',
    );
  });
});

describe('setStyle', () => {
  it('creates, updates and removes a style element', () => {
    setStyle(document, 's1', 'a {}');
    expect(document.getElementById('s1')?.textContent).toBe('a {}');
    setStyle(document, 's1', 'b {}');
    expect(document.querySelectorAll('#s1')).toHaveLength(1);
    expect(document.getElementById('s1')?.textContent).toBe('b {}');
    setStyle(document, 's1', null);
    expect(document.getElementById('s1')).toBeNull();
  });
});

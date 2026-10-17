// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { STYLE_IDS } from '../../src/content/styles';
import { TweakManager } from '../../src/content/tweaks';
import type { Tweak } from '../../src/sites/types';

const cleanup = vi.fn();
const run = vi.fn(() => cleanup);
const tweaks: Tweak[] = [
  { id: 't.a', site: 't', label: 'A', css: '.a { display: none !important; }' },
  { id: 't.b', site: 't', label: 'B', css: '.b { display: none !important; }', run },
];

const css = () => document.getElementById(STYLE_IDS.tweaks)?.textContent ?? null;

describe('TweakManager', () => {
  it('injects CSS of enabled tweaks, runs and cleans up behaviours', () => {
    const m = new TweakManager(document, tweaks);
    m.apply({});
    expect(css()).toBeNull();

    m.apply({ 't.a': true, 't.b': true });
    expect(css()).toContain('.a {');
    expect(css()).toContain('.b {');
    expect(run).toHaveBeenCalledTimes(1);

    m.apply({ 't.a': true, 't.b': true });
    expect(run).toHaveBeenCalledTimes(1);

    m.apply({ 't.a': true });
    expect(css()).not.toContain('.b {');
    expect(cleanup).toHaveBeenCalledTimes(1);

    m.apply({});
    expect(css()).toBeNull();
  });

  it('survives a throwing tweak', () => {
    const bad: Tweak = { id: 't.bad', site: 't', label: 'Bad', run: () => { throw new Error('x'); } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => new TweakManager(document, [bad]).apply({ 't.bad': true })).not.toThrow();
    warn.mockRestore();
  });
});

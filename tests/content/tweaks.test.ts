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
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a throwing cleanup does not break apply or the other tweaks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badCleanup = vi.fn(() => { throw new Error('c'); });
    const badRun = vi.fn(() => badCleanup);
    const otherRun = vi.fn(() => () => {});
    const list: Tweak[] = [
      { id: 't.bad', site: 't', label: 'Bad', run: badRun },
      { id: 't.other', site: 't', label: 'Other', run: otherRun },
    ];
    const m = new TweakManager(document, list);
    m.apply({ 't.bad': true });
    expect(() => m.apply({ 't.other': true })).not.toThrow();
    expect(badCleanup).toHaveBeenCalledTimes(1);
    expect(otherRun).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[scrim] tweak cleanup failed', 't.bad', expect.any(Error));

    // The failed entry is gone, so enabling it again runs it again.
    m.apply({ 't.bad': true });
    expect(badRun).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('a throwing run is attempted once across identical apply calls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badRun = vi.fn(() => { throw new Error('x'); });
    const m = new TweakManager(document, [{ id: 't.bad', site: 't', label: 'Bad', run: badRun }]);
    m.apply({ 't.bad': true });
    m.apply({ 't.bad': true });
    expect(badRun).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

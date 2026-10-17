import { describe, expect, it } from 'vitest';
import { latestRun } from '../../src/content/latest';

describe('latestRun', () => {
  it('only the most recently started run is current', () => {
    const begin = latestRun();
    const first = begin();
    expect(first()).toBe(true);
    const second = begin();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('an older async run that resumes late sees it was superseded', async () => {
    const begin = latestRun();
    const applied: string[] = [];
    const check = async (url: string, delay: number) => {
      const current = begin();
      await new Promise((r) => setTimeout(r, delay));
      if (current()) applied.push(url);
    };
    // The first check (old page) is slower than the second (new page): only the new one applies.
    await Promise.all([check('/old', 20), check('/new', 0)]);
    expect(applied).toEqual(['/new']);
  });

  it('separate trackers are independent', () => {
    const a = latestRun();
    const b = latestRun();
    const runA = a();
    b();
    expect(runA()).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { assessHealth, NO_ITEMS_AFTER_MS, type HealthInput } from '../../src/core/health';

const input = (patch: Partial<HealthInput> = {}): HealthInput => ({
  site: 'Reddit',
  active: true,
  expectsItems: true,
  elapsedMs: NO_ITEMS_AFTER_MS,
  stats: { found: 20, errors: 0, empty: 0 },
  ...patch,
});

describe('assessHealth', () => {
  it('is idle when nothing is being filtered', () => {
    expect(assessHealth(input({ active: false })).status).toBe('idle');
  });

  it('is ok and says how many items it checks', () => {
    expect(assessHealth(input())).toEqual({ status: 'ok', message: 'Checking 20 items on this page.' });
    expect(assessHealth(input({ stats: { found: 1, errors: 0, empty: 0 } })).message).toBe(
      'Checking 1 item on this page.',
    );
  });

  it('warns when a feed page shows no items after the grace period', () => {
    const h = assessHealth(input({ stats: { found: 0, errors: 0, empty: 0 } }));
    expect(h.status).toBe('warn');
    expect(h.message).toContain('Reddit may have changed');
  });

  it('does not warn during the grace period or on pages without a feed', () => {
    const none = { found: 0, errors: 0, empty: 0 };
    expect(assessHealth(input({ stats: none, elapsedMs: NO_ITEMS_AFTER_MS - 1 })).status).toBe('ok');
    expect(assessHealth(input({ stats: none, expectsItems: false })).status).toBe('idle');
  });

  it('warns when many items could not be read', () => {
    const h = assessHealth(input({ stats: { found: 10, errors: 3, empty: 0 } }));
    expect(h.status).toBe('warn');
    expect(h.message).toContain('3 of 10');
  });

  it('ignores a single extraction error', () => {
    expect(assessHealth(input({ stats: { found: 4, errors: 1, empty: 0 } })).status).toBe('ok');
  });

  it('warns when most items never got any text', () => {
    const h = assessHealth(input({ stats: { found: 10, errors: 0, empty: 6 } }));
    expect(h.status).toBe('warn');
    expect(h.message).toContain('had no text');
    expect(assessHealth(input({ stats: { found: 3, errors: 0, empty: 2 } })).status).toBe('ok'); // too few to judge
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ data: {} as Record<string, unknown>, fail: false }));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      session: {
        get: vi.fn(async (key: string) => {
          if (store.fail) throw new Error('Access to storage is not allowed from this context.');
          return key in store.data ? { [key]: store.data[key] } : {};
        }),
        set: vi.fn(async (items: Record<string, unknown>) => Object.assign(store.data, items)),
      },
    },
  },
}));

const { peekEnd, startPeek } = await import('../../src/platform/peek');

beforeEach(() => {
  store.data = {};
  store.fail = false;
});

describe('page-source peeks', () => {
  it('startPeek returns the expiry, five minutes ahead, and peekEnd reports it', async () => {
    const before = Date.now();
    const until = await startPeek('gh:acme');
    expect(until).toBeGreaterThanOrEqual(before + 5 * 60_000);
    expect(await peekEnd('gh:acme')).toBe(until);
  });

  it('peekEnd is null for unknown, expired, or unreadable peeks', async () => {
    expect(await peekEnd('gh:acme')).toBeNull();
    store.data['peek:gh:acme'] = Date.now() - 1;
    expect(await peekEnd('gh:acme')).toBeNull();
    store.data['peek:gh:acme'] = Date.now() + 60_000;
    store.fail = true;
    expect(await peekEnd('gh:acme')).toBeNull();
  });
});

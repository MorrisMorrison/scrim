import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeRule {
  id: number;
  condition: { requestDomains?: string[] };
}

const fake = vi.hoisted(() => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const state = {
    session: [] as FakeRule[],
    dynamic: [] as FakeRule[],
    tabs: [] as { id?: number; url?: string }[],
  };
  const browser = {
    declarativeNetRequest: {
      getSessionRules: vi.fn(async () => {
        await tick();
        return state.session.map((r) => ({ ...r }));
      }),
      getDynamicRules: vi.fn(async () => state.dynamic.map((r) => ({ ...r }))),
      // Like Chrome: a duplicate id rejects the whole update.
      updateSessionRules: vi.fn(
        async ({ removeRuleIds = [], addRules = [] }: { removeRuleIds?: number[]; addRules?: FakeRule[] }) => {
          await tick();
          const kept = state.session.filter((r) => !removeRuleIds.includes(r.id));
          for (const r of addRules) {
            if (kept.some((k) => k.id === r.id)) throw new Error(`Rule with id ${r.id} already exists`);
            kept.push(r);
          }
          state.session = kept;
        },
      ),
    },
    alarms: { create: vi.fn(async () => {}) },
    tabs: {
      query: vi.fn(async () => state.tabs),
      reload: vi.fn((id: number) => Promise.resolve(id)),
    },
  };
  return { state, browser };
});

vi.mock('wxt/browser', () => ({ browser: fake.browser }));

const { endSitePeek, startSitePeek } = await import('../../src/background/blocking');

const blockRule = (id: number, domain: string): FakeRule => ({ id, condition: { requestDomains: [domain] } });

beforeEach(() => {
  fake.state.session = [];
  fake.state.dynamic = [blockRule(1000, 'news.ycombinator.com'), blockRule(1001, 'reddit.com')];
  fake.state.tabs = [];
  vi.clearAllMocks();
});

describe('site peeks', () => {
  it('adds an allow rule and an alarm named after the domain', async () => {
    await startSitePeek('news.ycombinator.com');
    expect(fake.state.session.map((r) => r.condition.requestDomains)).toEqual([['news.ycombinator.com']]);
    expect(fake.browser.alarms.create).toHaveBeenCalledWith('peek:news.ycombinator.com', { delayInMinutes: 5 });
  });

  it('concurrent peeks on different domains get distinct rule ids', async () => {
    await Promise.all([startSitePeek('news.ycombinator.com'), startSitePeek('reddit.com')]);
    const ids = fake.state.session.map((r) => r.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('peeking the same domain again replaces its rule', async () => {
    await startSitePeek('reddit.com');
    await startSitePeek('reddit.com');
    expect(fake.state.session).toHaveLength(1);
  });

  it('ending a peek removes only that domain rule and reloads its open tabs', async () => {
    await startSitePeek('news.ycombinator.com');
    await startSitePeek('reddit.com');
    fake.state.tabs = [
      { id: 1, url: 'https://news.ycombinator.com/item?id=1' },
      { id: 2, url: 'https://old.reddit.com/r/cats' },
      { id: 3, url: 'https://example.org/' },
      { id: 4, url: 'not a url' },
      { url: 'https://news.ycombinator.com/' },
    ];
    await endSitePeek('peek:news.ycombinator.com');
    expect(fake.state.session.map((r) => r.condition.requestDomains)).toEqual([['reddit.com']]);
    expect(fake.browser.tabs.reload.mock.calls.map(([id]) => id)).toEqual([1]);
  });

  it('a failing tab reload does not reject', async () => {
    await startSitePeek('reddit.com');
    fake.state.tabs = [{ id: 7, url: 'https://reddit.com/' }];
    fake.browser.tabs.reload.mockRejectedValueOnce(new Error('No tab with id: 7'));
    await expect(endSitePeek('peek:reddit.com')).resolves.toBeUndefined();
    expect(fake.browser.tabs.reload).toHaveBeenCalledWith(7);
  });

  it('does not reload tabs of a domain that is no longer blocked', async () => {
    await startSitePeek('reddit.com');
    fake.state.dynamic = [];
    fake.state.tabs = [{ id: 7, url: 'https://reddit.com/' }];
    await endSitePeek('peek:reddit.com');
    expect(fake.state.session).toEqual([]);
    expect(fake.browser.tabs.reload).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { blockMessage } from '../../src/core/messages';
import {
  blockedDomains,
  blockingTopic,
  buildBlockRules,
  newlyBlocked,
  peekRule,
} from '../../src/core/rules';
import { parseState, type ScrimState } from '../../src/core/store';
import { emptyOverride } from '../../src/core/topics';

const PAGE = 'chrome-extension://abc/block.html';

function state(patch: (s: ScrimState) => void = () => {}): ScrimState {
  const s = parseState({});
  patch(s);
  return s;
}

describe('blockedDomains', () => {
  it('is empty for the Default profile (AI has no blocked sites)', () => {
    expect(blockedDomains(state())).toEqual([]);
  });

  it('collects blocked sites of every active topic', () => {
    const s = state((s) => {
      s.settings.activeProfileId = 'downtime';
      const ov = emptyOverride();
      ov.added.blockSites.push('WWW.Jira.Example.com', 'news.ycombinator.com');
      s.overrides.work = ov;
    });
    expect(blockedDomains(s)).toEqual(['jira.example.com', 'news.ycombinator.com']);
  });

  it('drops disabled sites and everything when switched off', () => {
    const s = state((s) => {
      s.settings.activeProfileId = 'downtime';
      s.settings.disabledSites = ['ycombinator.com'];
    });
    expect(blockedDomains(s)).toEqual([]);
    const off = state((s) => {
      s.settings.activeProfileId = 'downtime';
      s.settings.enabled = false;
    });
    expect(blockedDomains(off)).toEqual([]);
  });
});

describe('buildBlockRules', () => {
  it('builds one redirect rule per domain carrying the original URL', () => {
    const s = state((s) => {
      s.settings.activeProfileId = 'downtime';
    });
    expect(buildBlockRules(s, PAGE)).toEqual([
      {
        id: 1000,
        priority: 1,
        action: { type: 'redirect', redirect: { regexSubstitution: `${PAGE}#\\0` } },
        condition: {
          regexFilter: '^.+$',
          requestDomains: ['news.ycombinator.com'],
          resourceTypes: ['main_frame'],
        },
      },
    ]);
  });
});

describe('peekRule', () => {
  it('allows a domain at a higher priority than the redirect', () => {
    expect(peekRule(7, 'news.ycombinator.com')).toEqual({
      id: 7,
      priority: 2,
      action: { type: 'allow' },
      condition: { requestDomains: ['news.ycombinator.com'], resourceTypes: ['main_frame'] },
    });
  });
});

describe('blockingTopic', () => {
  it('names the topic and domain that block a host', () => {
    const s = state((s) => {
      s.settings.activeProfileId = 'downtime';
    });
    const b = blockingTopic(s, 'news.ycombinator.com');
    expect(b?.topic.id).toBe('software');
    expect(b?.domain).toBe('news.ycombinator.com');
    expect(blockingTopic(s, 'example.org')).toBeNull();
    expect(blockingTopic(state(), 'news.ycombinator.com')).toBeNull();
  });
});

describe('newlyBlocked', () => {
  it('returns domains present only in next', () => {
    expect(newlyBlocked(['a.com'], ['a.com', 'b.com'])).toEqual(['b.com']);
  });
});

describe('blockMessage', () => {
  it('fills every placeholder', () => {
    const msg = blockMessage({ site: 'Hacker News', topic: 'Software/IT', profile: 'Downtime' }, () => 0);
    expect(msg).toContain('Hacker News');
    expect(msg).not.toMatch(/[{}]/);
  });
});

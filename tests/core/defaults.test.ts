import { describe, expect, it } from 'vitest';
import { BUILTIN_TOPIC_IDS, BUILTIN_TOPICS, DEFAULT_PROFILES } from '../../src/core/defaults';
import { compileKeywords, firstMatch } from '../../src/core/matcher';
import { buildPipeline } from '../../src/core/pipeline';
import { sourceKey } from '../../src/core/sources';

const hits = (id: keyof typeof BUILTIN_TOPICS, text: string) =>
  firstMatch(text, compileKeywords(BUILTIN_TOPICS[id].keywords)) !== null;

describe('shipped topics', () => {
  it('are consistent and free of duplicate entries', () => {
    expect(BUILTIN_TOPIC_IDS).toEqual([
      'ai',
      'software',
      'work',
      'politics',
      'markets',
      'hustle',
      'ragebait',
      'news',
      'gossip',
      'spoilers',
      'nsfw',
    ]);
    for (const id of BUILTIN_TOPIC_IDS) {
      const t = BUILTIN_TOPICS[id];
      expect(t.id).toBe(id);
      expect(new Set(t.keywords).size, `${id} keywords`).toBe(t.keywords.length);
      expect(new Set(t.sources.map(sourceKey)).size, `${id} sources`).toBe(t.sources.length);
    }
  });

  it('default profiles only reference shipped topics', () => {
    for (const p of DEFAULT_PROFILES) {
      for (const t of p.topics) expect(BUILTIN_TOPIC_IDS).toContain(t);
    }
  });
});

describe('default sources', () => {
  const pipeline = buildPipeline(BUILTIN_TOPIC_IDS.map((id) => BUILTIN_TOPICS[id]));
  const topicOf = (name: string) =>
    pipeline.evaluate({ text: '', sources: [{ kind: 'subreddit', name }] })?.topicId ?? null;

  it('route well-known subreddits to their topic', () => {
    expect(topicOf('accelerate')).toBe('ai');
    expect(topicOf('singularity')).toBe('ai');
    expect(topicOf('programming')).toBe('software');
    expect(topicOf('LinkedInLunatics')).toBe('work');
    expect(topicOf('politics')).toBe('politics');
    expect(topicOf('wallstreetbets')).toBe('markets');
    expect(topicOf('sidehustle')).toBe('hustle');
    expect(topicOf('PublicFreakout')).toBe('ragebait');
    expect(topicOf('worldnews')).toBe('news');
    expect(topicOf('Fauxmoi')).toBe('gossip');
    expect(topicOf('gardening')).toBeNull();
  });
});

describe('software keywords additions', () => {
  it('catch Linux and Rust-the-language', () => {
    expect(hits('software', 'Linux Torvalds')).toBe(true);
    expect(hits('software', 'Learning Rust programming in 2026')).toBe(true);
    expect(hits('software', 'why rustlang won')).toBe(true);
    expect(hits('software', 'rust spots on the old car')).toBe(false);
  });
});

describe('work keywords', () => {
  it('catch work content', () => {
    for (const s of [
      'Posted on LinkedIn about my promotion',
      'Big tech layoffs continue',
      'How I prepared for my job interview',
      'Return to office mandates are back',
      'Tipps für die Gehaltsverhandlung',
      'Meine Bewerbung wurde abgelehnt',
    ]) {
      expect(hits('work', s), s).toBe(true);
    }
  });

  it('leave everyday text alone', () => {
    for (const s of [
      'the band played a great office party set',
      'resume playback where you left off',
      'my cat works hard at napping',
    ]) {
      expect(hits('work', s), s).toBe(false);
    }
  });
});

describe('politics keywords', () => {
  it('catch political content in English and German', () => {
    for (const s of [
      'Senate passes the new bill',
      'Trump announces tariffs',
      'Election results are in',
      'Merz und die Koalition streiten',
      'Die AfD legt in Umfragen zu',
      'Debatte im Bundestag',
    ]) {
      expect(hits('politics', s), s).toBe(true);
    }
  });

  it('leave everyday text alone', () => {
    for (const s of [
      'my favourite card game has a trump suit',
      'the party starts at eight',
      'wir haben die Wahl zwischen Pizza und Pasta',
    ]) {
      expect(hits('politics', s), s).toBe(false);
    }
  });
});

const topicCases: [keyof typeof BUILTIN_TOPICS, string[], string[]][] = [
  [
    'markets',
    [
      'Bitcoin breaks 100k',
      'this memecoin is going to the moon',
      'BTC and ETH dump overnight',
      'Nasdaq closes at record high',
      'Lohnt sich ein ETF-Sparplan?',
      'Die Börse bricht ein',
    ],
    ['chicken stock for the soup', 'the moon is bright tonight', 'my favourite coin collection'],
  ],
  [
    'hustle',
    [
      'My side hustle makes $5k a month',
      'Passive income ideas for 2026',
      'Sigma male grindset morning routine',
      'Passives Einkommen mit Dividenden',
    ],
    ['my morning coffee', 'she is a great football coach', 'a quiet evening routine walk'],
  ],
  [
    'ragebait',
    [
      "You won't believe what happened next",
      'SHOCKING footage from the city council',
      'Comedian DESTROYS heckler',
      'unpopular opinion: pineapple belongs on pizza',
      'Politiker rastet im Interview aus',
    ],
    ['a shocking amount of rain today', 'the door slams shut', 'the storm destroyed the old barn'],
  ],
  [
    'news',
    [
      'Missile strike hits apartment block',
      'Death toll rises after earthquake',
      'War crimes investigation opened',
      'Anschlag in der Innenstadt',
      'Neue Kämpfe an der Front im Krieg',
    ],
    ['Star Wars marathon tonight', 'the shooting guard scored 30 points', 'a flood of new ideas'],
  ],
  [
    'gossip',
    [
      'Celebrity couple splits after 3 years',
      'Every look from the Met Gala red carpet',
      'Taylor Swift fans react to new album',
      'Die Promis im Dschungelcamp',
    ],
    ['tea time with grandma', 'we bought a red rug for the hall', 'my sister swims fast'],
  ],
  [
    'spoilers',
    ['Ending explained: what that final scene means', 'Major spoilers ahead!', 'The post-credits scene sets up a sequel'],
    ['the season starts in May', 'a quiet evening with a good book'],
  ],
];

describe.each(topicCases)('%s keywords', (id, matches, misses) => {
  it.each(matches)('match: %s', (s) => expect(hits(id, s)).toBe(true));
  it.each(misses)('miss: %s', (s) => expect(hits(id, s)).toBe(false));
});

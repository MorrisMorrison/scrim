import { describe, expect, it } from 'vitest';
import type { Topic } from '../../src/core/model';
import { buildPipeline } from '../../src/core/pipeline';

const topic = (id: string, patch: Partial<Topic> = {}): Topic => ({
  id,
  name: id,
  keywords: [],
  sources: [],
  blockSites: [],
  ...patch,
});

const ai = topic('ai', { keywords: ['LLM'], sources: [{ kind: 'subreddit', name: 'ChatGPT' }] });
const work = topic('work', {
  keywords: ['standup'],
  sources: [
    { kind: 'github-owner', owner: 'acme-corp' },
    { kind: 'domain', host: 'acme.example' },
  ],
});

describe('buildPipeline', () => {
  it('is empty without topics and never matches', () => {
    const p = buildPipeline([]);
    expect(p.empty).toBe(true);
    expect(p.evaluate({ text: 'LLM', sources: [] })).toBeNull();
  });

  it('matches keywords and names the keyword', () => {
    const p = buildPipeline([ai, work]);
    expect(p.evaluate({ text: 'running an LLM', sources: [] })).toEqual({
      topicId: 'ai',
      reason: 'keyword "LLM"',
      match: { kind: 'keyword', keyword: 'LLM', text: 'LLM' },
    });
    expect(p.evaluate({ text: 'daily standup notes', sources: [] })?.topicId).toBe('work');
  });

  it('matches typed sources exactly, case-insensitively', () => {
    const p = buildPipeline([ai, work]);
    expect(p.evaluate({ text: '', sources: [{ kind: 'subreddit', name: 'chatgpt' }] })).toEqual({
      topicId: 'ai',
      reason: 'source r/chatgpt',
      match: { kind: 'source', source: { kind: 'subreddit', name: 'chatgpt' } },
    });
    expect(p.evaluate({ text: '', sources: [{ kind: 'subreddit', name: 'ChatGPTPro' }] })).toBeNull();
    expect(
      p.evaluate({ text: '', sources: [{ kind: 'github-owner', owner: 'ACME-corp' }] })?.topicId,
    ).toBe('work');
  });

  it('matches domain sources including subdomains', () => {
    const p = buildPipeline([work]);
    expect(p.evaluate({ text: '', sources: [{ kind: 'domain', host: 'jira.acme.example' }] })?.topicId).toBe(
      'work',
    );
    expect(p.evaluate({ text: '', sources: [{ kind: 'domain', host: 'notacme.example' }] })).toBeNull();
  });

  it('runs the source stage before the keyword stage', () => {
    const p = buildPipeline([ai, work]);
    const v = p.evaluate({ text: 'an LLM post', sources: [{ kind: 'github-owner', owner: 'acme-corp' }] });
    expect(v?.topicId).toBe('work');
    expect(v?.reason).toBe('source gh:acme-corp');
  });

  it('reports the first topic in profile order when several keyword-match', () => {
    const p = buildPipeline([work, ai]);
    expect(p.evaluate({ text: 'LLM standup', sources: [] })?.topicId).toBe('work');
  });
});

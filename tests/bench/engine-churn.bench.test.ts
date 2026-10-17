// @vitest-environment happy-dom
// Before/after benchmark for the engine on a busy page (run explicitly, not part of `pnpm test`):
//   pnpm bench   (results are appended to tests/bench/results.txt)
// Counts are what matter; happy-dom timings only indicate the trend, not Chrome's numbers.
import { appendFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { Engine } from '../../src/content/engine';
import type { Topic } from '../../src/core/model';
import { buildPipeline } from '../../src/core/pipeline';
import type { SiteAdapter } from '../../src/sites/types';

const ai: Topic = { id: 'ai', name: 'AI', keywords: ['LLM'], sources: [], blockSites: [] };
const ITEMS = 300;
const FRAMES = 100;

function page(): string {
  const items = Array.from(
    { length: ITEMS },
    (_, i) =>
      `<div class="item"><a href="/v/${i}">video ${i}</a><span class="views" id="v${i}">${i} views</span></div>`,
  ).join('');
  return `<div id="feed">${items}</div><div id="chat"></div>`;
}

async function measure(label: string, topics: Topic[]) {
  document.body.innerHTML = page();
  const extract = vi.fn((el: Element) => ({ text: el.textContent ?? '', sources: [] }));
  const adapter: SiteAdapter = { id: 'b', label: 'B', hosts: ['localhost'], itemSelector: '.item', extract };
  const frames: FrameRequestCallback[] = [];
  const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  const qsa = vi.spyOn(document, 'querySelectorAll');
  const engine = new Engine({ adapter, doc: document });
  engine.configure({ pipeline: buildPipeline(topics), action: 'hide', topicNames: { ai: 'AI' } });
  engine.start();
  extract.mockClear();
  qsa.mockClear();
  let framesRun = 0;
  const chat = document.getElementById('chat') as HTMLElement;
  const t0 = performance.now();
  for (let f = 0; f < FRAMES; f++) {
    // Live chat: 3 new lines in, 3 old lines out.
    for (let i = 0; i < 3; i++) chat.appendChild(document.createElement('p')).textContent = `msg ${f}-${i}`;
    while (chat.childElementCount > 30) chat.firstElementChild?.remove();
    // Live counters inside 10 feed items.
    for (let i = 0; i < 10; i++) (document.getElementById(`v${(f * 10 + i) % ITEMS}`) as HTMLElement).textContent = `${f} views`;
    // One new feed item every 10 frames.
    if (f % 10 === 0) {
      document.getElementById('feed')?.insertAdjacentHTML('beforeend', `<div class="item"><a href="/n/${f}">an LLM video ${f}</a></div>`);
    }
    await Promise.resolve();
    for (const cb of frames.splice(0)) {
      cb(0);
      framesRun++;
    }
  }
  const ms = performance.now() - t0;
  const fullDocQueries = qsa.mock.calls.length;
  const hits = document.querySelectorAll('[data-scrim^="hit"]').length;
  engine.stop();
  raf.mockRestore();
  qsa.mockRestore();
  const line =
    `${label}: frames run ${framesRun}, full-document queries ${fullDocQueries}, ` +
    `extract calls ${extract.mock.calls.length}, new items hidden ${hits}, ${ms.toFixed(0)} ms (happy-dom)`;
  // Vitest swallows console output of passing tests; append to a git-ignored file instead.
  appendFileSync('tests/bench/results.txt', `${new Date().toISOString()} ${line}\n`);
  return { framesRun, fullDocQueries, extract: extract.mock.calls.length, hits };
}

it('engine on a busy page', async () => {
  const active = await measure('AI topic on', [ai]);
  const idle = await measure('nothing to filter', []);
  expect(active.hits).toBe(FRAMES / 10);
  expect(idle.hits).toBe(0);
}, 120_000);

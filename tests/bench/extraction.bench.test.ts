// @vitest-environment happy-dom
// Before/after benchmark for extraction and the Google AI Overview tweak. Run with `pnpm bench`;
// results are appended to tests/bench/results.txt. Counts are exact; timings only show the trend.
import { appendFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { BUILTIN_TOPIC_IDS, BUILTIN_TOPICS } from '../../src/core/defaults';
import type { SourceRef } from '../../src/core/model';
import { buildPipeline } from '../../src/core/pipeline';
import { linkDomains } from '../../src/sites/dom';
import { hideAiOverview } from '../../src/sites/google';

function record(line: string) {
  appendFileSync('tests/bench/results.txt', `${new Date().toISOString()} ${line}\n`);
}

function time(fn: () => void): number {
  fn(); // warm-up
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

it('linkDomains on Reddit-like items (mostly relative links)', () => {
  const links =
    Array.from({ length: 20 }, (_, i) => `<a href="/r/sub/comments/${i}">c</a>`).join('') +
    Array.from({ length: 5 }, (_, i) => `<a href="https://ext${i}.example.org/x">e</a>`).join('');
  document.body.innerHTML = `<div class="item">${links}</div>`.repeat(50);
  const items = Array.from(document.querySelectorAll('.item'));
  let found = 0;
  const ms = time(() => {
    found = 0;
    for (const el of items) found += linkDomains(el).length;
  });
  record(`linkDomains: 50 items x 25 links: ${ms.toFixed(1)} ms (happy-dom), domains found ${found}`);
  expect(found).toBe(250);
});

it('source stage with all topics', () => {
  const pipeline = buildPipeline(BUILTIN_TOPIC_IDS.map((id) => BUILTIN_TOPICS[id]));
  const sources: SourceRef[] = [
    { kind: 'subreddit', name: 'gardening' },
    { kind: 'domain', host: 'www.cooking.example.org' },
    { kind: 'domain', host: 'img.example.net' },
  ];
  const ms = time(() => {
    for (let i = 0; i < 20_000; i++) pipeline.evaluate({ text: '', sources });
  });
  record(`source stage: 20k items x 3 sources x 11 topics: ${ms.toFixed(1)} ms`);
});

it('Google AI Overview tweak on a changing results page', async () => {
  const results = Array.from(
    { length: 100 },
    (_, i) => `<div class="g"><h2>Result ${i}</h2><div>snippet</div></div>`,
  ).join('');
  document.body.innerHTML = `<div id="center_col"><div id="rso">${results}</div><div id="side"></div></div>`;
  const frames: FrameRequestCallback[] = [];
  const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  const qsa = vi.spyOn(document, 'querySelectorAll');
  const offset = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get');
  const cleanup = hideAiOverview.run?.(document) ?? (() => {});
  qsa.mockClear();
  offset.mockClear();
  const side = document.getElementById('side') as HTMLElement;
  const t0 = performance.now();
  for (let f = 0; f < 100; f++) {
    side.appendChild(document.createElement('span')).textContent = `tick ${f}`;
    await Promise.resolve();
    for (const cb of frames.splice(0)) cb(0);
  }
  // The overview arrives late, deep inside a new block.
  side.insertAdjacentHTML('beforeend', '<div id="late"><div><h2>AI Overview</h2><p>answer</p></div></div>');
  await Promise.resolve();
  for (const cb of frames.splice(0)) cb(0);
  const ms = performance.now() - t0;
  const hidden = !!document.querySelector('#late h2')?.closest('[data-scrim-aio]');
  record(
    `AI Overview tweak, 100 churn frames: document queries ${qsa.mock.calls.length}, ` +
      `layout reads ${offset.mock.calls.length}, late overview hidden ${hidden}, ${ms.toFixed(0)} ms (happy-dom)`,
  );
  expect(hidden).toBe(true);
  cleanup();
  raf.mockRestore();
  qsa.mockRestore();
  offset.mockRestore();
});

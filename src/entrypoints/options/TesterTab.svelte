<script lang="ts">
  import { buildPipeline } from '../../core/pipeline';
  import { allTopics, type ScrimState } from '../../core/store';

  let { state: scrim }: { state: ScrimState } = $props();

  let text = $state('');
  let excluded = $state<string[]>([]);
  const topics = $derived(allTopics(scrim));
  const results = $derived(
    text.trim()
      ? topics
          .filter((t) => !excluded.includes(t.id))
          .map((t) => ({ topic: t, verdict: buildPipeline([t]).evaluate({ text, sources: [] }) }))
          .filter((r) => r.verdict !== null)
      : [],
  );

  function toggle(id: string, on: boolean) {
    excluded = on ? excluded.filter((x) => x !== id) : [...excluded, id];
  }
</script>

<section>
  <p class="muted">Paste a headline or post to see which topics and keywords would hide it.</p>
  <textarea bind:value={text} rows="5" placeholder="e.g. I built an AI agent in Python"></textarea>
  <div class="row">
    {#each topics as t (t.id)}
      <label>
        <input type="checkbox" checked={!excluded.includes(t.id)} onchange={(e) => toggle(t.id, e.currentTarget.checked)} />
        {t.name}
      </label>
    {/each}
  </div>
  {#if text.trim()}
    {#if results.length}
      <ul>
        {#each results as r (r.topic.id)}
          <li><strong>{r.topic.name}</strong>: {r.verdict?.reason}</li>
        {/each}
      </ul>
    {:else}
      <p>No match: this would stay visible.</p>
    {/if}
  {/if}
</section>

<style>
  section { display: flex; flex-direction: column; gap: 10px; }
  textarea { width: 100%; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
</style>

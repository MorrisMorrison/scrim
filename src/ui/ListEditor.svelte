<script lang="ts">
  import type { ListItem } from './list-item';

  let {
    title,
    items,
    placeholder,
    validate,
    onadd,
    onremove,
  }: {
    title: string;
    items: ListItem[];
    placeholder: string;
    validate: (input: string) => string | null;
    onadd: (input: string) => void;
    onremove: (key: string) => void;
  } = $props();

  let input = $state('');
  const error = $derived(input.trim() ? validate(input) : null);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!input.trim() || error) return;
    onadd(input.trim());
    input = '';
  }
</script>

<section class="list-editor">
  <h3>{title} <span class="muted">({items.length})</span></h3>
  <form onsubmit={submit}>
    <input bind:value={input} {placeholder} aria-invalid={error !== null} aria-label="Add to {title}" />
    <button type="submit" disabled={!input.trim() || error !== null}>Add</button>
  </form>
  {#if error}<p class="error">{error}</p>{/if}
  <ul class="chips">
    {#each items as item (item.key)}
      <li class:default={item.isDefault}>
        <span>{item.label}</span>
        {#if item.isDefault}<small class="muted">default</small>{/if}
        <button type="button" class="link" aria-label="Remove {item.label}" onclick={() => onremove(item.key)}>×</button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .list-editor { margin-bottom: 20px; }
  h3 { font-size: 14px; margin: 0 0 6px; }
  form { display: flex; gap: 6px; }
  form input { flex: 1; min-width: 0; }
  .chips { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .chips li {
    display: flex; align-items: center; gap: 4px; padding: 2px 8px;
    border: 1px solid var(--border); border-radius: 999px;
  }
  .chips li:not(.default) { border-color: var(--accent); }
</style>

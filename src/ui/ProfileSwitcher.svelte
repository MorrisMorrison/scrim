<script lang="ts">
  import type { Profile } from '../core/model';

  let {
    profiles,
    activeId,
    onselect,
    disabled = false,
  }: {
    profiles: Profile[];
    activeId: string;
    onselect: (id: string) => void;
    disabled?: boolean;
  } = $props();
</script>

<div class="switcher" role="radiogroup" aria-label="Active profile">
  {#each profiles as p (p.id)}
    <button
      type="button"
      role="radio"
      aria-checked={p.id === activeId}
      class:active={p.id === activeId}
      {disabled}
      onclick={() => onselect(p.id)}>{p.name}</button
    >
  {/each}
</div>

<style>
  .switcher { display: flex; flex-wrap: wrap; gap: 6px; }
  .active { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
</style>

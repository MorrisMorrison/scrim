<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createStateStore } from '../../ui/scrim-state.svelte';
  import BackupTab from './BackupTab.svelte';
  import ProfilesTab from './ProfilesTab.svelte';
  import SitesTab from './SitesTab.svelte';
  import TesterTab from './TesterTab.svelte';
  import TopicsTab from './TopicsTab.svelte';

  const store = createStateStore();
  onDestroy(store.stop);

  const TABS = ['Profiles', 'Topics', 'Sites', 'Backup', 'Keyword tester'] as const;
  let tab = $state<(typeof TABS)[number]>('Profiles');
</script>

<header>
  <h1>Scrim</h1>
  <nav>
    {#each TABS as t (t)}
      <button class:active={tab === t} onclick={() => (tab = t)}>{t}</button>
    {/each}
  </nav>
</header>

<main>
  {#if store.state}
    {#if tab === 'Profiles'}
      <ProfilesTab state={store.state} />
    {:else if tab === 'Topics'}
      <TopicsTab state={store.state} />
    {:else if tab === 'Sites'}
      <SitesTab state={store.state} />
    {:else if tab === 'Backup'}
      <BackupTab state={store.state} />
    {:else}
      <TesterTab state={store.state} />
    {/if}
  {:else}
    <p class="muted">Loading…</p>
  {/if}
</main>

<style>
  header, main { max-width: 900px; margin: 0 auto; padding: 16px; }
  header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  h1 { margin: 0; font-size: 20px; }
  nav { display: flex; gap: 6px; flex-wrap: wrap; }
  .active { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
</style>

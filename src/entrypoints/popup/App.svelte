<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { hostMatches, normalizeHost } from '../../core/host';
  import { activeProfile, allTopics, isHostDisabled, saveSettings } from '../../core/store';
  import { localKV, onStoreChanged } from '../../platform/kv';
  import type { LogResponse, Message } from '../../platform/messages';
  import ProfileSwitcher from '../../ui/ProfileSwitcher.svelte';
  import { createStateStore } from '../../ui/scrim-state.svelte';

  const store = createStateStore();
  onDestroy(store.stop);

  let tabId = $state<number | null>(null);
  let host = $state('');
  let info = $state<LogResponse | null>(null);
  let showLog = $state(false);

  const topicNames = $derived(
    store.state ? Object.fromEntries(allTopics(store.state).map((t) => [t.id, t.name])) : {},
  );
  const siteOff = $derived(store.state && host ? isHostDisabled(store.state, host) : false);

  async function refreshInfo() {
    if (tabId === null) return;
    try {
      const msg: Message = { type: 'scrim:getLog' };
      info = ((await browser.tabs.sendMessage(tabId, msg)) as LogResponse | undefined) ?? null;
    } catch {
      info = null; // no Scrim content script on this tab
    }
  }

  onMount(() => {
    void (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id ?? null;
      try {
        host = tab?.url ? new URL(tab.url).hostname : '';
      } catch {
        host = '';
      }
      await refreshInfo();
    })();
    // Content scripts reset on settings changes; give them a moment, then re-read.
    return onStoreChanged(() => setTimeout(() => void refreshInfo(), 300));
  });

  async function setEnabled(enabled: boolean) {
    if (store.state) await saveSettings(localKV, { ...store.state.settings, enabled });
  }

  async function setProfile(id: string) {
    if (store.state) await saveSettings(localKV, { ...store.state.settings, activeProfileId: id });
  }

  async function toggleSite() {
    const s = store.state?.settings;
    if (!s || !host) return;
    const disabledSites = siteOff
      ? s.disabledSites.filter((d) => !hostMatches(host, d))
      : [...s.disabledSites, normalizeHost(host)];
    await saveSettings(localKV, { ...s, disabledSites });
  }

  async function setReveal(on: boolean) {
    if (tabId === null) return;
    const msg: Message = { type: 'scrim:reveal', on };
    await browser.tabs.sendMessage(tabId, msg).catch(() => {});
    await refreshInfo();
  }
</script>

<main>
  {#if store.state}
    <header>
      <h1>Scrim</h1>
      <label>
        <input
          type="checkbox"
          checked={store.state.settings.enabled}
          onchange={(e) => setEnabled(e.currentTarget.checked)}
        />
        On
      </label>
    </header>

    <ProfileSwitcher
      profiles={store.state.profiles}
      activeId={activeProfile(store.state).id}
      onselect={setProfile}
      disabled={!store.state.settings.enabled}
    />

    {#if host}
      <label class="row">
        <input type="checkbox" checked={siteOff} onchange={toggleSite} />
        Off on {normalizeHost(host)}
      </label>
    {/if}

    {#if info}
      <section>
        <p><strong>{info.total}</strong> hidden on this page</p>
        {#if info.total > 0}
          <ul class="counts">
            {#each Object.entries(info.counts) as [id, n] (id)}
              <li>{topicNames[id] ?? id}: {n}</li>
            {/each}
          </ul>
        {/if}
        <label class="row">
          <input type="checkbox" checked={info.revealed} onchange={(e) => setReveal(e.currentTarget.checked)} />
          Reveal hidden items
        </label>
        {#if info.log.length}
          <button class="link" onclick={() => (showLog = !showLog)}>{showLog ? 'Hide' : 'Show'} log</button>
          {#if showLog}
            <ol class="log">
              {#each info.log as entry, i (i)}
                <li>
                  <span>{entry.snippet}</span>
                  <small class="muted">{topicNames[entry.topicId] ?? entry.topicId} · {entry.reason}</small>
                </li>
              {/each}
            </ol>
          {/if}
        {/if}
      </section>
    {:else}
      <p class="muted">Scrim doesn't filter items on this page.</p>
    {/if}

    <footer>
      <button class="link" onclick={() => browser.runtime.openOptionsPage()}>Options</button>
      <button
        class="link"
        title="Reload Scrim from disk after `pnpm run update` (unpacked install)"
        onclick={() => browser.runtime.reload()}>Reload Scrim</button
      >
    </footer>
  {/if}
</main>

<style>
  main { width: 320px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  header { display: flex; justify-content: space-between; align-items: center; }
  h1 { font-size: 16px; margin: 0; }
  p { margin: 0; }
  section { display: flex; flex-direction: column; gap: 6px; }
  .counts { margin: 0; padding-left: 18px; }
  .log { margin: 0; padding-left: 18px; max-height: 220px; overflow: auto; }
  .log li { display: flex; flex-direction: column; margin-bottom: 4px; }
  footer { border-top: 1px solid var(--border); padding-top: 8px; display: flex; justify-content: space-between; }
</style>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { browser } from 'wxt/browser';
  import { blockMessage } from '../../core/messages';
  import { blockingTopic } from '../../core/rules';
  import { activeProfile, loadState, saveSettings } from '../../core/store';
  import { localKV } from '../../platform/kv';
  import type { Message } from '../../platform/messages';
  import ProfileSwitcher from '../../ui/ProfileSwitcher.svelte';
  import { createStateStore } from '../../ui/scrim-state.svelte';

  // The redirect rule appends the original URL as the hash.
  const target = location.hash.slice(1);
  const host = (() => {
    try {
      return new URL(target).hostname;
    } catch {
      return '';
    }
  })();

  const store = createStateStore();
  onDestroy(store.stop);

  let busy = $state(false);
  const block = $derived(store.state ? blockingTopic(store.state, host) : null);
  const profile = $derived(store.state ? activeProfile(store.state) : null);
  const message = $derived(
    block && profile
      ? blockMessage({ site: host.replace(/^www\./, ''), topic: block.topic.name, profile: profile.name })
      : '',
  );

  function go() {
    if (target) location.replace(target);
  }

  // Stale block page (profile switched elsewhere): continue to the site.
  $effect(() => {
    if (store.state && !block && !busy) go();
  });

  async function peek() {
    if (!block) return;
    busy = true;
    const msg: Message = { type: 'scrim:peek', domain: block.domain };
    await browser.runtime.sendMessage(msg);
    go();
  }

  async function switchProfile(id: string) {
    const s = store.state;
    if (!s) return;
    busy = true;
    await saveSettings(localKV, { ...s.settings, activeProfileId: id });
    const msg: Message = { type: 'scrim:sync' };
    await browser.runtime.sendMessage(msg);
    busy = false;
    if (!blockingTopic(await loadState(localKV), host)) go();
  }
</script>

<main>
  {#if store.state && block && profile}
    <div class="emoji">🚫</div>
    <h1>{message}</h1>
    <p class="sub">{block.topic.name} · {profile.name}</p>
    <button onclick={peek} disabled={busy}>Peek for 5 min</button>
    <section>
      <h2>Switch profile</h2>
      <ProfileSwitcher profiles={store.state.profiles} activeId={profile.id} onselect={switchProfile} disabled={busy} />
    </section>
  {/if}
</main>

<style>
  main {
    min-height: 100vh; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 12px; padding: 24px; text-align: center;
  }
  .emoji { font-size: 64px; line-height: 1; }
  h1 { font-size: 24px; margin: 0; max-width: 520px; }
  .sub { color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; font-size: 13px; margin: 0 0 12px; }
  section { margin-top: 24px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  h2 { font-size: 13px; font-weight: 500; color: var(--muted); margin: 0; }
</style>

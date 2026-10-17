<script lang="ts">
  import type { Action, Profile } from '../../core/model';
  import { allTopics, deleteProfile, saveProfile, type ScrimState } from '../../core/store';
  import { localKV } from '../../platform/kv';
  import { ADAPTERS, TWEAKS } from '../../sites';

  let { state: scrim }: { state: ScrimState } = $props();

  const ACTIONS: { value: Action; label: string }[] = [
    { value: 'hide', label: 'Hide' },
    { value: 'blur', label: 'Blur (click to reveal)' },
    { value: 'collapse', label: 'Collapse to a bar' },
  ];
  const groups = ADAPTERS.map((site) => ({ site, tweaks: TWEAKS.filter((t) => t.site === site.id) })).filter(
    (g) => g.tweaks.length > 0,
  );

  let selectedId = $state<string | null>(null);
  const profile = $derived(
    scrim.profiles.find((p) => p.id === selectedId) ??
      scrim.profiles.find((p) => p.id === scrim.settings.activeProfileId) ??
      scrim.profiles[0]!,
  );
  const topics = $derived(allTopics(scrim));

  function update(patch: Partial<Profile>) {
    void saveProfile(localKV, { ...profile, ...patch });
  }

  function toggleTopic(id: string, on: boolean) {
    update({ topics: on ? [...profile.topics, id] : profile.topics.filter((t) => t !== id) });
  }

  function toggleTweak(id: string, on: boolean) {
    const tweaks = { ...profile.tweaks };
    if (on) tweaks[id] = true;
    else delete tweaks[id];
    update({ tweaks });
  }

  async function create() {
    const p: Profile = { id: crypto.randomUUID(), name: 'New profile', topics: [], action: 'hide', tweaks: {} };
    await saveProfile(localKV, p);
    selectedId = p.id;
  }

  async function remove() {
    if (!confirm(`Delete profile "${profile.name}"?`)) return;
    const next = scrim.profiles.find((p) => p.id !== profile.id);
    await deleteProfile(localKV, scrim, profile.id);
    selectedId = next?.id ?? null;
  }
</script>

<div class="layout">
  <nav>
    {#each scrim.profiles as p (p.id)}
      <button class:selected={p.id === profile.id} onclick={() => (selectedId = p.id)}>
        {p.name}{p.id === scrim.settings.activeProfileId ? ' · active' : ''}
      </button>
    {/each}
    <button class="link" onclick={create}>+ New profile</button>
  </nav>

  <section>
    <label>
      Name
      <input
        value={profile.name}
        onchange={(e) => update({ name: e.currentTarget.value.trim() || profile.name })}
      />
    </label>

    <fieldset>
      <legend>Topics</legend>
      {#each topics as t (t.id)}
        <label>
          <input
            type="checkbox"
            checked={profile.topics.includes(t.id)}
            onchange={(e) => toggleTopic(t.id, e.currentTarget.checked)}
          />
          {t.name}
        </label>
      {/each}
    </fieldset>

    <fieldset>
      <legend>When something matches</legend>
      {#each ACTIONS as a (a.value)}
        <label>
          <input
            type="radio"
            name="action-{profile.id}"
            checked={profile.action === a.value}
            onchange={() => update({ action: a.value })}
          />
          {a.label}
        </label>
      {/each}
    </fieldset>

    <fieldset>
      <legend>Site tweaks</legend>
      {#each groups as g (g.site.id)}
        <h4>{g.site.label}</h4>
        {#each g.tweaks as t (t.id)}
          <label>
            <input
              type="checkbox"
              checked={!!profile.tweaks[t.id]}
              onchange={(e) => toggleTweak(t.id, e.currentTarget.checked)}
            />
            {t.label}
          </label>
        {/each}
      {/each}
    </fieldset>

    <button class="danger" disabled={scrim.profiles.length <= 1} onclick={remove}>Delete profile</button>
  </section>
</div>

<style>
  .layout { display: grid; grid-template-columns: 200px 1fr; gap: 16px; }
  @media (max-width: 640px) { .layout { grid-template-columns: 1fr; } }
  nav { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
  .selected { border-color: var(--accent); }
  section { display: flex; flex-direction: column; gap: 12px; }
  h4 { margin: 8px 0 4px; font-size: 13px; color: var(--muted); }
</style>

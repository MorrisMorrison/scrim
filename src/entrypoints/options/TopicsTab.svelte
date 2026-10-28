<script lang="ts">
  import { BUILTIN_TOPICS, isBuiltinTopicId } from '../../core/defaults';
  import { normalizeHost } from '../../core/host';
  import { validateKeyword } from '../../core/matcher';
  import type { Topic } from '../../core/model';
  import { formatSource, parseSource } from '../../core/sources';
  import {
    addTopicEntry,
    allTopics,
    deleteCustomTopic,
    removeTopicEntry,
    saveCustomTopic,
    type ScrimState,
  } from '../../core/store';
  import { entryKey, hasEntry, type AnyEntry, type ListField } from '../../core/topics';
  import { localKV } from '../../platform/kv';
  import ListEditor from '../../ui/ListEditor.svelte';
  import type { ListItem } from '../../ui/list-item';

  let { state: scrim }: { state: ScrimState } = $props();

  let selectedId = $state('ai');
  let newName = $state('');
  const topics = $derived(allTopics(scrim));
  const topic = $derived(topics.find((t) => t.id === selectedId) ?? topics[0]!);

  const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

  function parseInput(field: ListField, input: string): AnyEntry | null {
    if (field === 'sources') return parseSource(input);
    if (field === 'blockSites') {
      const host = normalizeHost(input);
      return DOMAIN.test(host) ? host : null;
    }
    return input.trim() || null;
  }

  const FIELDS: { field: ListField; title: string; placeholder: string; validate: (i: string) => string | null }[] = [
    { field: 'keywords', title: 'Keywords', placeholder: 'word, phrase or /regex/i', validate: validateKeyword },
    {
      field: 'sources',
      title: 'Sources',
      placeholder: 'r/name · yt:@handle · x:@handle · gh:owner · domain',
      validate: (i) => (parseSource(i) ? null : 'Use r/name, yt:@handle, x:@handle, gh:owner or a domain'),
    },
    {
      field: 'blockSites',
      title: 'Blocked sites (whole site, while this topic is active)',
      placeholder: 'example.com',
      validate: (i) => (parseInput('blockSites', i) ? null : 'Enter a domain like example.com'),
    },
  ];

  function itemsFor(t: Topic, field: ListField): ListItem[] {
    const shipped = isBuiltinTopicId(t.id) ? (BUILTIN_TOPICS[t.id][field] as AnyEntry[]) : [];
    return (t[field] as AnyEntry[]).map((v) => ({
      key: entryKey(field, v),
      label: typeof v === 'string' ? v : formatSource(v),
      isDefault: hasEntry(field, shipped, v),
    }));
  }

  async function add(field: ListField, input: string) {
    const value = parseInput(field, input);
    if (value === null) return;
    await addTopicEntry(localKV, scrim, topic.id, field, value);
  }

  async function remove(field: ListField, key: string) {
    const items = topic[field] as AnyEntry[];
    const value = items.find((v) => entryKey(field, v) === key);
    if (value === undefined) return;
    await removeTopicEntry(localKV, scrim, topic.id, field, value);
  }

  async function createTopic(e: SubmitEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const t: Topic = { id: crypto.randomUUID(), name, keywords: [], sources: [], blockSites: [] };
    await saveCustomTopic(localKV, t);
    newName = '';
    selectedId = t.id;
  }

  async function rename(name: string) {
    if (!isBuiltinTopicId(topic.id) && name.trim()) await saveCustomTopic(localKV, { ...topic, name: name.trim() });
  }

  async function deleteTopic() {
    if (!confirm(`Delete topic "${topic.name}"? It is also removed from every profile.`)) return;
    await deleteCustomTopic(localKV, scrim, topic.id);
    selectedId = 'ai';
  }
</script>

<div class="layout">
  <nav>
    {#each topics as t (t.id)}
      <button class:selected={t.id === topic.id} onclick={() => (selectedId = t.id)}>{t.name}</button>
    {/each}
    <form onsubmit={createTopic}>
      <input bind:value={newName} placeholder="New topic name" aria-label="New topic name" />
      <button type="submit" disabled={!newName.trim()}>Add</button>
    </form>
  </nav>

  <section>
    {#if isBuiltinTopicId(topic.id)}
      <h2>{topic.name}</h2>
      <p class="muted">Built-in topic. Shipped entries are marked "default"; removing one only hides it for you.</p>
    {:else}
      <label>
        Name
        <input value={topic.name} onchange={(e) => rename(e.currentTarget.value)} />
      </label>
    {/if}

    {#each FIELDS as f (f.field)}
      <ListEditor
        title={f.title}
        items={itemsFor(topic, f.field)}
        placeholder={f.placeholder}
        validate={f.validate}
        onadd={(input) => void add(f.field, input)}
        onremove={(key) => void remove(f.field, key)}
      />
    {/each}

    {#if !isBuiltinTopicId(topic.id)}
      <button class="danger" onclick={deleteTopic}>Delete topic</button>
    {/if}
  </section>
</div>

<style>
  .layout { display: grid; grid-template-columns: 200px 1fr; gap: 16px; }
  @media (max-width: 640px) { .layout { grid-template-columns: 1fr; } }
  nav { display: flex; flex-direction: column; gap: 6px; }
  nav form { display: flex; gap: 4px; margin-top: 8px; }
  nav form input { flex: 1; min-width: 0; }
  .selected { border-color: var(--accent); }
  h2 { margin: 0 0 4px; font-size: 18px; }
</style>

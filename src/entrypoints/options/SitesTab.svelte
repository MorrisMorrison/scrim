<script lang="ts">
  import { normalizeHost } from '../../core/host';
  import { formatSource, parseSource, sourceKey } from '../../core/sources';
  import { saveAllow, saveSettings, type ScrimState } from '../../core/store';
  import { localKV } from '../../platform/kv';
  import ListEditor from '../../ui/ListEditor.svelte';

  let { state }: { state: ScrimState } = $props();

  const items = $derived(state.settings.disabledSites.map((d) => ({ key: d, label: d, isDefault: false })));
  const validate = (input: string) =>
    /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(normalizeHost(input)) ? null : 'Enter a domain like example.com';

  async function add(input: string) {
    const host = normalizeHost(input);
    if (state.settings.disabledSites.includes(host)) return;
    await saveSettings(localKV, { ...state.settings, disabledSites: [...state.settings.disabledSites, host] });
  }

  // "Never hide": sources whose posts stay visible whatever the topics say.
  const allowItems = $derived(
    state.allow.map((s) => ({ key: sourceKey(s), label: formatSource(s), isDefault: false })),
  );
  const validateSource = (input: string) =>
    parseSource(input) ? null : 'Use r/name, yt:@handle, x:@handle, gh:owner or a domain';

  async function addAllow(input: string) {
    const source = parseSource(input);
    if (!source || state.allow.some((a) => sourceKey(a) === sourceKey(source))) return;
    await saveAllow(localKV, [...state.allow, source]);
  }

  async function removeAllow(key: string) {
    await saveAllow(localKV, state.allow.filter((a) => sourceKey(a) !== key));
  }

  async function remove(key: string) {
    await saveSettings(localKV, {
      ...state.settings,
      disabledSites: state.settings.disabledSites.filter((d) => d !== key),
    });
  }
</script>

<p class="muted">Scrim does nothing on these sites or their subdomains: no filtering, no tweaks, no blocking.</p>
<ListEditor
  title="Disabled sites"
  {items}
  placeholder="example.com"
  {validate}
  onadd={(input) => void add(input)}
  onremove={(key) => void remove(key)}
/>

<p class="muted">
  Posts from these sources are never hidden, whatever the topics say. Add one here, from the popup log, or by
  right-clicking a post → Scrim → Always show posts from this source.
</p>
<ListEditor
  title="Never hide"
  items={allowItems}
  placeholder="r/name · yt:@handle · x:@handle · gh:owner · domain"
  validate={validateSource}
  onadd={(input) => void addAllow(input)}
  onremove={(key) => void removeAllow(key)}
/>

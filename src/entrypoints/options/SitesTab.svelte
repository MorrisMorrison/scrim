<script lang="ts">
  import { normalizeHost } from '../../core/host';
  import { saveSettings, type ScrimState } from '../../core/store';
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

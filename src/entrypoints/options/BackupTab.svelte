<script lang="ts">
  import { exportState, parseExport, replaceState, resetAll, type ScrimState } from '../../core/store';
  import { localKV } from '../../platform/kv';

  let { state: scrim }: { state: ScrimState } = $props();
  let message = $state('');

  function exportJson() {
    const blob = new Blob([JSON.stringify(exportState(scrim), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrim-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importJson(e: Event & { currentTarget: HTMLInputElement }) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      message = 'That file is not valid JSON.';
      return;
    }
    const parsed = parseExport(data);
    if (typeof parsed === 'string') {
      message = parsed;
      return;
    }
    if (!confirm('Replace all Scrim settings with this backup?')) return;
    await replaceState(localKV, parsed);
    message = 'Backup imported.';
  }

  async function reset() {
    if (!confirm('Reset all profiles, topics and settings to defaults?')) return;
    await resetAll(localKV);
    message = 'Reset to defaults.';
  }
</script>

<section>
  <p class="muted">
    Backups contain your profiles, custom topics and keyword/source changes, which may include
    work orgs and domains. Keep them out of public repos.
  </p>
  <div class="row">
    <button onclick={exportJson}>Export JSON</button>
    <label class="file">
      <span>Import JSON</span>
      <input type="file" accept="application/json,.json" onchange={importJson} />
    </label>
    <button class="danger" onclick={reset}>Reset to defaults</button>
  </div>
  {#if message}<p>{message}</p>{/if}
</section>

<style>
  section { display: flex; flex-direction: column; gap: 12px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .file input { max-width: 220px; }
</style>

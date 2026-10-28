import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Scrim',
    description:
      'Hide whole topics (AI, work, software/IT, NSFW, your own) across feeds, block sites, and tame YouTube.',
    permissions: ['storage', 'tabs', 'alarms', 'contextMenus', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [{ resources: ['block.html'], matches: ['<all_urls>'] }],
  },
});

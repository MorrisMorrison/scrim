// The right-click menu Scrim adds on tuned sites. Pure: the background turns these into
// chrome.contextMenus entries and rebuilds them when topics change.
import type { Topic } from './model';

export const MENU_ROOT = 'scrim';
export const MENU_HIDE = 'scrim-hide';
export const MENU_HIDE_PREFIX = 'scrim-hide:';
export const MENU_ALLOW = 'scrim-allow';

export interface MenuItem {
  id: string;
  title: string;
  parentId?: string;
}

export function menuItems(topics: readonly Topic[]): MenuItem[] {
  return [
    { id: MENU_ROOT, title: 'Scrim' },
    { id: MENU_HIDE, title: 'Hide posts from this source in…', parentId: MENU_ROOT },
    ...topics.map((t) => ({ id: `${MENU_HIDE_PREFIX}${t.id}`, title: t.name, parentId: MENU_HIDE })),
    { id: MENU_ALLOW, title: 'Always show posts from this source', parentId: MENU_ROOT },
  ];
}

// The topic a "hide in…" menu click refers to, or null for any other entry.
export function hideTopicId(menuItemId: string): string | null {
  return menuItemId.startsWith(MENU_HIDE_PREFIX) ? menuItemId.slice(MENU_HIDE_PREFIX.length) : null;
}

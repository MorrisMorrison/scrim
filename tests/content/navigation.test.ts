import { describe, expect, it } from 'vitest';
import { watchNavigation, type NavigationSource } from '../../src/content/navigation';

// A fake page: tests drive the location-change signal, pageshow, deferred tasks and location.
function fakePage(href: string) {
  const page = {
    href,
    locationChange: [] as ((e: { newUrl: URL }) => void)[],
    pageShow: [] as ((e: { persisted: boolean }) => void)[],
    deferred: [] as (() => void)[],
    flush() {
      const tasks = page.deferred.splice(0);
      for (const t of tasks) t();
    },
  };
  const source: NavigationSource = {
    onLocationChange: (h) => page.locationChange.push(h),
    onPageShow: (h) => page.pageShow.push(h),
    defer: (fn) => page.deferred.push(fn),
    href: () => page.href,
  };
  return { page, source };
}

function watch(href: string) {
  const { page, source } = fakePage(href);
  const seen: string[] = [];
  watchNavigation(source, (url) => seen.push(url.pathname));
  const navigate = (dest: string) => page.locationChange.forEach((h) => h({ newUrl: new URL(dest) }));
  return { page, seen, navigate };
}

describe('watchNavigation', () => {
  it('checks the committed URL after an SPA navigation, not before', () => {
    const { page, seen, navigate } = watch('https://github.com/me');
    // The Navigation API fires before the URL commits...
    navigate('https://github.com/acme');
    expect(seen).toEqual([]);
    // ...pushState / intercepted navigations have committed by the deferred task.
    page.href = 'https://github.com/acme';
    page.flush();
    expect(seen).toEqual(['/acme']);
  });

  it('a cross-document or cancelled navigation re-checks the page we are still on', () => {
    const { page, seen, navigate } = watch('https://github.com/me');
    navigate('https://github.com/acme'); // a full-load link to a blocked org; location never changes here
    page.flush();
    expect(seen).toEqual(['/me']);
  });

  it('re-checks a page restored from the back/forward cache, but not a fresh load', () => {
    const { page, seen } = watch('https://github.com/me');
    page.pageShow.forEach((h) => h({ persisted: false }));
    expect(seen).toEqual([]);
    page.pageShow.forEach((h) => h({ persisted: true }));
    expect(seen).toEqual(['/me']);
  });
});

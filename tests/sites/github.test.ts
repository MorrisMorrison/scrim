// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { github, ownerFromPath, repoOwnerFromHref } from '../../src/sites/github';
import { loadFixture } from '../helpers/fixture';

describe('github helpers', () => {
  it('find the owner of a page', () => {
    expect(ownerFromPath('/acme-corp')).toBe('acme-corp');
    expect(ownerFromPath('/Acme-Corp/api/pulls')).toBe('acme-corp');
    expect(ownerFromPath('/orgs/acme-corp/people')).toBe('acme-corp');
    expect(ownerFromPath('/settings/profile')).toBeNull();
    expect(ownerFromPath('/')).toBeNull();
  });

  it('take repo owners only from root repo/owner links', () => {
    expect(repoOwnerFromHref('/acme-corp/billing-service')).toBe('acme-corp');
    expect(repoOwnerFromHref('/acme-corp')).toBe('acme-corp');
    expect(repoOwnerFromHref('/acme-corp/billing-service/stargazers')).toBeNull();
    expect(repoOwnerFromHref('/topics/kernel')).toBeNull();
  });
});

describe('github adapter', () => {
  beforeEach(() => loadFixture('github/search.html'));

  it('is source-only', () => {
    expect(github.sourcesOnly).toBe(true);
  });

  it('extracts repo owners from result rows', () => {
    const row = document.getElementById('work-row') as Element;
    expect(row.matches(github.itemSelector)).toBe(true);
    expect(github.extract(row).sources).toEqual([{ kind: 'github-owner', owner: 'acme-corp' }]);
  });

  it('knows the owner of the current page', () => {
    expect(github.pageSource?.(new URL('https://github.com/acme-corp/api'))).toEqual({
      kind: 'github-owner',
      owner: 'acme-corp',
    });
  });
});

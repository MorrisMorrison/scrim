import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));

const { menuMessage } = await import('../../src/background/menus');

describe('menuMessage', () => {
  it('turns menu clicks into content-script messages', () => {
    expect(menuMessage('scrim-hide:work')).toEqual({ type: 'scrim:menu', action: 'hide', topicId: 'work' });
    expect(menuMessage('scrim-allow')).toEqual({ type: 'scrim:menu', action: 'allow' });
    expect(menuMessage('scrim')).toBeNull();
    expect(menuMessage('scrim-hide')).toBeNull();
  });
});

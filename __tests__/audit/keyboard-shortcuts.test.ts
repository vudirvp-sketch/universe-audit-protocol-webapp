/**
 * Keyboard shortcut matcher — pure, so layout behaviour can be tested without a DOM.
 *
 * Regression: the sidebar shortcut was matched on `e.key === '['` only. On a
 * Russian keyboard layout that key produces `х`, so the shortcut never fired for
 * the app's primary audience.
 */
import { describe, it, expect } from 'vitest';
import { matchShortcut } from '@/hooks/useKeyboardShortcuts';

type KeyEvent = Parameters<typeof matchShortcut>[0];

function key(overrides: Partial<KeyEvent>): KeyEvent {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides,
  };
}

describe('matchShortcut', () => {
  it('toggles the sidebar from the bracket key on a US layout', () => {
    expect(matchShortcut(key({ key: '[', code: 'BracketLeft' }), 'done')).toEqual({
      type: 'toggle-sidebar',
    });
  });

  it('toggles the sidebar from the physical bracket key on a Russian layout', () => {
    expect(matchShortcut(key({ key: 'х', code: 'BracketLeft' }), 'done')).toEqual({
      type: 'toggle-sidebar',
    });
  });

  it('closes the inspector on Escape', () => {
    expect(matchShortcut(key({ key: 'Escape', code: 'Escape' }), 'done')).toEqual({
      type: 'close-inspector',
    });
  });

  it('jumps to a block with digits 1-5 only while a run exists', () => {
    expect(matchShortcut(key({ key: '3', code: 'Digit3' }), 'running')).toEqual({
      type: 'scroll-to-block',
      block: 3,
    });
    expect(matchShortcut(key({ key: '3', code: 'Digit3' }), 'done')).toEqual({
      type: 'scroll-to-block',
      block: 3,
    });
    expect(matchShortcut(key({ key: '3', code: 'Digit3' }), 'idle')).toEqual({ type: 'none' });
  });

  it('ignores shortcuts when a modifier is held (browser tab switching, etc.)', () => {
    expect(matchShortcut(key({ key: '1', code: 'Digit1', ctrlKey: true }), 'done')).toEqual({
      type: 'none',
    });
    expect(matchShortcut(key({ key: '[', code: 'BracketLeft', metaKey: true }), 'done')).toEqual({
      type: 'none',
    });
  });
});

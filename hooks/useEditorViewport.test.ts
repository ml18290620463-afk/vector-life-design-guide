import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useEditorViewport } from './useEditorViewport';
afterEach(() => vi.unstubAllGlobals());
it('tracks keyboard viewport and offset, ignores pinch zoom, and removes listeners on close', () => {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  const node = document.createElement('dialog');
  const ref = { current: node };
  const { rerender } = renderHook(({ enabled }) => useEditorViewport(ref, enabled), {
    initialProps: { enabled: true },
  });
  expect(node.style.getPropertyValue('--editor-visible-height')).toBe('800px');
  act(() => {
    viewport.height = 420;
    viewport.offsetTop = 36;
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(node.style.getPropertyValue('--editor-visible-height')).toBe('420px');
  expect(node.style.getPropertyValue('--editor-visible-top')).toBe('36px');
  act(() => {
    viewport.scale = 2;
    viewport.height = 210;
    viewport.dispatchEvent(new Event('scroll'));
  });
  expect(node.style.getPropertyValue('--editor-visible-height')).toBe('420px');
  rerender({ enabled: false });
  expect(node.style.getPropertyValue('--editor-visible-height')).toBe('');
  act(() => {
    viewport.scale = 1;
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(node.style.getPropertyValue('--editor-visible-height')).toBe('');
});

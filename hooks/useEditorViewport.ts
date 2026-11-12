import { useEffect, type RefObject } from 'react';

/** Track the unobscured viewport without interfering with pinch zoom. */
export function useEditorViewport(ref: RefObject<HTMLDialogElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    const viewport = window.visualViewport;
    if (!node || !viewport) return;
    const update = () => {
      if (viewport.scale !== 1) return;
      node.style.setProperty('--editor-visible-height', `${viewport.height}px`);
      node.style.setProperty('--editor-visible-top', `${viewport.offsetTop}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      node.style.removeProperty('--editor-visible-height');
      node.style.removeProperty('--editor-visible-top');
    };
  }, [ref, enabled]);
}

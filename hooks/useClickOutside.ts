import { useEffect, useRef } from 'react';

/**
 * Returns a ref that the caller attaches to the surface they want to keep
 * open. Whenever a `mousedown` lands outside that surface (or anywhere
 * on `Escape`) and `enabled` is true, `onOutside()` fires.
 *
 *  - The ref value is stable; callers can spread it onto any
 *    `HTMLDivElement` (the most common case for dropdowns / menus).
 *  - When `enabled` is false the listener is detached entirely, so a
 *    closed dropdown costs nothing.
 *
 * Pulled out of `Dashboard.tsx` as part of Phase 2 §2.h — both the
 * language dropdown and the export dropdown had near-identical
 * effects and they both forgot to also handle the `Escape` key.
 */
export const useClickOutside = <T extends HTMLElement = HTMLDivElement>(
  enabled: boolean,
  onOutside: () => void,
) => {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOutside();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [enabled, onOutside]);

  return ref;
};

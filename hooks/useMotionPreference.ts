import { useReducedMotion } from 'motion/react';

/**
 * Wrapper around `motion/react`'s `useReducedMotion()` so the rest of the
 * codebase imports a project-owned hook (we keep one place to swap the
 * implementation if we move off `motion/react`).
 *
 * Returns `true` when the user has signalled they prefer reduced motion via
 * the OS setting (`prefers-reduced-motion: reduce`). Components should use
 * this to gate large/long animations or to swap to a CSS fade.
 */
export const useMotionPreference = (): boolean => {
  return Boolean(useReducedMotion());
};

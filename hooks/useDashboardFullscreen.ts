import { useCallback, useEffect, useState } from 'react';

export interface DashboardFullscreenState {
  isFullscreen: boolean;
  toggleFullScreen: () => void;
  /**
   * Imperative escape hatch (e.g. cancel button on a modal that was
   * opened in fullscreen). Identical to calling toggleFullScreen()
   * when isFullscreen is true.
   */
  exitFullscreen: () => void;
  /**
   * Keep external consumers in sync with our local boolean — useful
   * when an unrelated keystroke (Esc) drops the browser out of
   * fullscreen behind our back.
   */
  setIsFullscreen: (next: boolean) => void;
}

/**
 * Wraps the Fullscreen API + the inevitable cross-browser quirks:
 *
 *  - `document.fullscreenElement` is the source of truth for the
 *    actual browser state; our own `isFullscreen` boolean is just a
 *    React-friendly mirror used for prop pass-down (DashboardHeader
 *    renders Maximize vs Minimize off it, etc.).
 *  - We listen for `fullscreenchange` so an Esc key (or the OS
 *    fullscreen affordance) updates our mirror without the user
 *    having to click the in-app toggle.
 *
 * Pulled out of Dashboard.tsx as part of Phase 2 §2.h tail so the
 * surface can keep approaching the 350-LOC ROADMAP target.
 */
export const useDashboardFullscreen = (): DashboardFullscreenState => {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullScreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((e) => console.error(e));
    } else if (document.exitFullscreen) {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((e) => console.error(e));
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement && document.exitFullscreen) {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((e) => console.error(e));
    }
  }, []);

  return { isFullscreen, toggleFullScreen, exitFullscreen, setIsFullscreen };
};

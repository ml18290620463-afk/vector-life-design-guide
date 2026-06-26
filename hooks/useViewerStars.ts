import { useMemo } from 'react';
import { createSeededRandom } from '../lib/random';

export interface ViewerStars {
  fixedStars: Array<{ left: string; top: string; opacity: number }>;
  twinklingStars: Array<{ left: string; top: string; duration: number; delay: number }>;
  rippleStars: Array<{ top: string; right: string; duration: number; delay: number }>;
  decodedStars: Array<{ top: string; right: string; duration: number; delay: number }>;
}

/**
 * Deterministic decorative star fields, seeded by entry id so the same entry
 * always renders the same starscape (and so unrelated re-renders never reshuffle
 * them). Pulled out of Viewer.tsx so it can be memoized once and tested in
 * isolation.
 */
export const useViewerStars = (entryId: string): ViewerStars => {
  return useMemo(() => {
    const fixedStars = Array.from({ length: 80 }, (_, i) => {
      const random = createSeededRandom(`fixed-${entryId}-${i}`);
      return {
        left: `${random() * 100}%`,
        top: `${random() * 100}%`,
        opacity: random() * 0.4,
      };
    });
    const twinklingStars = Array.from({ length: 30 }, (_, i) => {
      const random = createSeededRandom(`twinkle-${entryId}-${i}`);
      return {
        left: `${random() * 100}%`,
        top: `${random() * 100}%`,
        duration: 4 + random() * 6,
        delay: random() * 5,
      };
    });
    const rippleStars = Array.from({ length: 8 }, (_, i) => {
      const random = createSeededRandom(`ripple-${entryId}-${i}`);
      return {
        top: `${10 + random() * 40}%`,
        right: `${10 + random() * 40}%`,
        duration: 2 + random() * 2,
        delay: random() * 5,
      };
    });
    const decodedStars = Array.from({ length: 6 }, (_, i) => {
      const random = createSeededRandom(`decoded-${entryId}-${i}`);
      return {
        top: `${random() * 60}%`,
        right: `${random() * 60}%`,
        duration: 2 + random() * 2,
        delay: random() * 4,
      };
    });
    return { fixedStars, twinklingStars, rippleStars, decodedStars };
  }, [entryId]);
};

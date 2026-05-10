import React from 'react';
import { motion } from 'motion/react';
import type { Theme } from '../types';

interface FixedStar {
  left: string;
  top: string;
  opacity: number;
}

interface TwinklingStar {
  left: string;
  top: string;
  duration: number;
  delay: number;
}

interface ViewerStarfieldProps {
  theme: Theme;
  fixedStars: readonly FixedStar[];
  twinklingStars: readonly TwinklingStar[];
}

/**
 * Decorative full-viewport star field that sits behind the Viewer's
 * letter & reading panels. Pulled out of `Viewer.tsx` so the viewer
 * file shrinks to its workflow logic and so the star field can be
 * memoised independently — the underlying data already comes from the
 * `useViewerStars` hook (entry-id-seeded, stable per entry), and the
 * component itself is pure, so React's default reconciliation skips it
 * on unrelated state changes.
 *
 * Honour `prefers-reduced-motion`: the parent `<MotionConfig>` in
 * `App.tsx` collapses transitions to ~0ms when the user opts in, so
 * twinkling stops without a per-component check.
 */
export const ViewerStarfield: React.FC<ViewerStarfieldProps> = React.memo(
  ({ theme, fixedStars, twinklingStars }) => (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      {/* Nebula gradients */}
      <div
        className={`absolute inset-0 opacity-30 ${theme === 'light' ? 'bg-[radial-gradient(circle_at_20%_30%,color-mix(in_srgb,_var(--color-vector-cyan-brand)_8%,_transparent),transparent_50%),radial-gradient(circle_at_80%_70%,color-mix(in_srgb,_var(--color-indigo-500)_4%,_transparent),transparent_50%)]' : 'bg-[radial-gradient(circle_at_20%_30%,color-mix(in_srgb,_var(--color-cyan-500)_12%,_transparent),transparent_50%),radial-gradient(circle_at_80%_70%,color-mix(in_srgb,_var(--color-indigo-500)_6%,_transparent),transparent_50%)]'}`}
      />

      {/* Static (non-animated) stars */}
      <div className="absolute inset-0">
        {fixedStars.map((star, i) => (
          <div
            key={`star-fix-${i}`}
            className={`absolute w-px h-px rounded-full ${theme === 'light' ? 'bg-slate-400' : 'bg-white/30'}`}
            style={star}
          />
        ))}
      </div>

      {/* Animated twinkling stars */}
      <div className="absolute inset-0">
        {twinklingStars.map((star, i) => (
          <motion.div
            key={`star-twinkle-${i}`}
            animate={{
              opacity: [0.1, 0.7, 0.1],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
            }}
            className={`absolute w-[2px] h-[2px] rounded-full blur-[1px] ${theme === 'light' ? 'bg-cyan-600/60' : 'bg-cyan-300/60'}`}
            style={{ left: star.left, top: star.top }}
          />
        ))}
      </div>
    </div>
  ),
);
ViewerStarfield.displayName = 'ViewerStarfield';

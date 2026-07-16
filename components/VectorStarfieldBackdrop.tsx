import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { Theme } from '../types';
import { useMotionPreference } from '../hooks/useMotionPreference';
import { createSeededRandom } from '../lib/random';

export interface VectorFixedStar {
  left: string;
  top: string;
  opacity: number;
  width?: string;
  height?: string;
  filter?: string;
}

export interface VectorTwinklingStar {
  left: string;
  top: string;
  duration: number;
  delay: number;
  repeatDelay?: number;
  peakOpacity?: number;
  width?: string;
  height?: string;
  x?: number;
  y?: number;
}

interface VectorStarfieldLayerProps {
  theme: Theme;
  fixedStars: readonly VectorFixedStar[];
  twinklingStars: readonly VectorTwinklingStar[];
  className?: string;
  fixedStarClassName?: string;
  twinklingStarClassName?: string;
}

interface VectorSeededStarfieldBackdropProps {
  theme: Theme;
  seed: string;
  fixedCount?: number;
  twinklingCount?: number;
  className?: string;
  fixedStarClassName?: string;
  twinklingStarClassName?: string;
}

const buildStarPosition = (seed: string, index: number) => {
  const random = createSeededRandom(seed);
  const column = index % 5;
  const row = Math.floor(index / 5) % 4;
  const left = (column + random() * 0.94) * 20 + (random() - 0.5) * 8;
  const top = (row + random() * 0.92) * 25 + (random() - 0.5) * 10;

  return {
    random,
    left: `${Math.max(1, Math.min(99, left))}%`,
    top: `${Math.max(1, Math.min(99, top))}%`,
  };
};

const getDefaultFixedStarClassName = (theme: Theme) =>
  `absolute w-px h-px rounded-full ${theme === 'light' ? 'bg-slate-400' : 'bg-white/40'}`;

const getDefaultTwinklingStarClassName = (theme: Theme) =>
  `absolute rounded-full blur-[1px] ${theme === 'light' ? 'bg-cyan-600' : 'bg-cyan-300'}`;

/**
 * Shared decorative starfield renderer.
 *
 * This is intentionally presentation-only: callers decide whether stars are
 * seeded from a stable id (`VectorSeededStarfieldBackdrop`) or supplied by a
 * workflow-specific hook (`ViewerStarfield`). Keeping the renderer here means
 * accessibility, reduced-motion handling, theme palettes and DOM shape stay
 * consistent across Cover / MasterLock / Viewer instead of drifting screen by
 * screen.
 */
export const VectorStarfieldLayer: React.FC<VectorStarfieldLayerProps> = React.memo(
  ({ theme, fixedStars, twinklingStars, className = '', fixedStarClassName, twinklingStarClassName }) => {
    const reduceMotion = useMotionPreference();
    const fixedClassName = fixedStarClassName ?? getDefaultFixedStarClassName(theme);
    const twinklingClassName = twinklingStarClassName ?? getDefaultTwinklingStarClassName(theme);

    return (
      <div className={`pointer-events-none ${className}`} aria-hidden="true">
        <div className="absolute inset-0">
          {fixedStars.map((star, i) => (
            <div key={`star-fix-${i}`} className={fixedClassName} style={star} />
          ))}
        </div>

        <div className="absolute inset-0">
          {twinklingStars.map((star, i) => (
            <motion.div
              key={`star-twinkle-${i}`}
              animate={
                reduceMotion
                  ? { opacity: star.peakOpacity ?? 0.4, scale: 1 }
                  : {
                      opacity: [0, star.peakOpacity ?? 0.7, 0],
                      scale: [0.35, 1, 0.45],
                      x: [0, star.x ?? 0, 0],
                      y: [0, star.y ?? 0, 0],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: star.duration,
                      repeat: Infinity,
                      delay: star.delay,
                      repeatDelay: star.repeatDelay ?? 0,
                    }
              }
              className={twinklingClassName}
              style={{
                left: star.left,
                top: star.top,
                width: star.width,
                height: star.height,
                opacity: star.peakOpacity,
              }}
            />
          ))}
        </div>
      </div>
    );
  },
);
VectorStarfieldLayer.displayName = 'VectorStarfieldLayer';

/**
 * Stable, seeded starfield used by ambient app shells.
 */
export const VectorSeededStarfieldBackdrop: React.FC<VectorSeededStarfieldBackdropProps> = ({
  theme,
  seed,
  fixedCount = 60,
  twinklingCount = 20,
  className = '',
  fixedStarClassName,
  twinklingStarClassName,
}) => {
  const fixedStars = useMemo(
    () =>
      Array.from({ length: fixedCount }, (_, i) => {
        const { random, left, top } = buildStarPosition(`${seed}-fixed-${i}`, i);
        const size = 0.6 + random() * 1.2;
        return {
          left,
          top,
          width: `${size}px`,
          height: `${size}px`,
          opacity: 0.05 + random() * 0.38,
          filter: random() > 0.72 ? 'blur(1px)' : 'none',
        };
      }),
    [fixedCount, seed],
  );

  const twinklingStars = useMemo(
    () =>
      Array.from({ length: twinklingCount }, (_, i) => {
        const { random, left, top } = buildStarPosition(`${seed}-twinkle-${i}`, i + 7);
        const size = 1.4 + random() * 2.6;
        return {
          left,
          top,
          width: `${size}px`,
          height: `${size}px`,
          duration: 3.2 + random() * 5.8,
          delay: random() * 8,
          repeatDelay: random() * 6,
          peakOpacity: 0.36 + random() * 0.54,
          x: (random() - 0.5) * 12,
          y: (random() - 0.5) * 10,
        };
      }),
    [seed, twinklingCount],
  );

  return (
    <VectorStarfieldLayer
      theme={theme}
      fixedStars={fixedStars}
      twinklingStars={twinklingStars}
      className={`absolute inset-0 ${className}`}
      fixedStarClassName={fixedStarClassName}
      twinklingStarClassName={twinklingStarClassName}
    />
  );
};

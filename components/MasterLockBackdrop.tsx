import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Theme } from '../types';
import { createSeededRandom } from '../lib/random';
import { useMotionPreference } from '../hooks/useMotionPreference';

interface MasterLockBackdropProps {
  theme: Theme;
}

const FIXED_STAR_COUNT = 60;
const TWINKLING_STAR_COUNT = 20;

/**
 * Fullscreen starfield decoration sitting behind the MasterLock card.
 * Pulled out of MasterLock.tsx as part of Phase 2 §2.i so the unlock
 * view can focus on auth state rather than ambient atmosphere.
 *
 * Star positions use seeded RNG (`createSeededRandom`) so they don't
 * jump between renders or theme toggles. When the OS prefers reduced
 * motion (see `useMotionPreference`), the twinkling animation collapses
 * to a static glow — the dust layer drops to a stable opacity and the
 * blink keyframes are skipped — avoiding 80+ continuous animations on
 * an already accessibility-sensitive screen.
 *
 * `aria-hidden` keeps the entire decoration out of the AT tree; nothing
 * here carries information that screen-reader users need to authenticate.
 */
export const MasterLockBackdrop: React.FC<MasterLockBackdropProps> = ({ theme }) => {
  const reduceMotion = useMotionPreference();

  const fixedStars = useMemo(
    () =>
      Array.from({ length: FIXED_STAR_COUNT }, (_, i) => {
        const random = createSeededRandom(`master-fixed-${i}`);
        return {
          left: `${random() * 100}%`,
          top: `${random() * 100}%`,
          opacity: random() * 0.5,
        };
      }),
    [],
  );

  const twinklingStars = useMemo(
    () =>
      Array.from({ length: TWINKLING_STAR_COUNT }, (_, i) => {
        const random = createSeededRandom(`master-twinkle-${i}`);
        return {
          left: `${random() * 100}%`,
          top: `${random() * 100}%`,
          duration: 2 + random() * 4,
          delay: random() * 5,
        };
      }),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* Nebula Gradients */}
      <div
        className={`absolute inset-0 opacity-40 ${theme === 'light' ? 'bg-[radial-gradient(circle_at_20%_30%,color-mix(in_srgb,_var(--color-vector-cyan-brand)_10%,_transparent),transparent_50%),radial-gradient(circle_at_80%_70%,color-mix(in_srgb,_var(--color-indigo-500)_5%,_transparent),transparent_50%)]' : 'bg-[radial-gradient(circle_at_20%_30%,color-mix(in_srgb,_var(--color-cyan-500)_15%,_transparent),transparent_50%),radial-gradient(circle_at_80%_70%,color-mix(in_srgb,_var(--color-indigo-500)_8%,_transparent),transparent_50%)]'}`}
      />

      {/* Fixed Stars */}
      <div className="absolute inset-0">
        {fixedStars.map((star, i) => (
          <div
            key={`star-fix-${i}`}
            className={`absolute w-px h-px rounded-full ${theme === 'light' ? 'bg-slate-400' : 'bg-white/40'}`}
            style={star}
          />
        ))}
      </div>

      {/* Twinkling Stars */}
      <div className="absolute inset-0">
        {twinklingStars.map((star, i) => (
          <motion.div
            key={`star-twinkle-${i}`}
            animate={
              reduceMotion
                ? { opacity: 0.4, scale: 1 }
                : {
                    opacity: [0, 0.8, 0],
                    scale: [0.5, 1, 0.5],
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: star.duration,
                    repeat: Infinity,
                    delay: star.delay,
                  }
            }
            className={`absolute w-[2px] h-[2px] rounded-full blur-[1px] ${theme === 'light' ? 'bg-cyan-600' : 'bg-cyan-300'}`}
            style={{ left: star.left, top: star.top }}
          />
        ))}
      </div>

      {/* Floating Spacetime Dust */}
      <motion.div
        animate={
          reduceMotion
            ? { opacity: theme === 'light' ? 0.05 : 0.1, scale: 1 }
            : {
                opacity: [0.05, 0.1, 0.05],
                scale: [1, 1.05, 1],
              }
        }
        transition={
          reduceMotion ? { duration: 0 } : { duration: 15, repeat: Infinity, ease: 'linear' }
        }
        className={`absolute inset-0 ${theme === 'light' ? 'bg-[url("https://www.transparenttextures.com/patterns/natural-paper.png")] opacity-5' : 'bg-[url("https://www.transparenttextures.com/patterns/dark-matter.png")] opacity-10'}`}
      />
    </div>
  );
};

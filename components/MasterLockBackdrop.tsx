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
        const { random, left, top } = buildStarPosition(`master-fixed-${i}`, i);
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
    [],
  );

  const twinklingStars = useMemo(
    () =>
      Array.from({ length: TWINKLING_STAR_COUNT }, (_, i) => {
        const { random, left, top } = buildStarPosition(`master-twinkle-${i}`, i + 7);
        const size = 1.4 + random() * 2.6;
        const peakOpacity = 0.36 + random() * 0.54;
        return {
          left,
          top,
          width: `${size}px`,
          height: `${size}px`,
          duration: 3.2 + random() * 5.8,
          delay: random() * 8,
          repeatDelay: random() * 6,
          peakOpacity,
          x: (random() - 0.5) * 12,
          y: (random() - 0.5) * 10,
        };
      }),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div
        className={`absolute inset-0 ${
          theme === 'light'
            ? 'bg-[linear-gradient(135deg,#f6fbff_0%,#eaf7fb_38%,#eef0ff_72%,#f9fbff_100%)]'
            : 'bg-[#020708]'
        }`}
      />
      {/* Nebula Gradients */}
      <div
        className={`absolute inset-0 opacity-70 ${theme === 'light' ? 'bg-[radial-gradient(circle_at_18%_24%,rgba(16,185,210,0.20),transparent_42%),radial-gradient(circle_at_78%_28%,rgba(139,92,246,0.16),transparent_44%),radial-gradient(circle_at_54%_78%,rgba(34,211,238,0.12),transparent_48%)]' : 'bg-[radial-gradient(circle_at_12%_22%,rgba(0,215,255,0.14),transparent_42%),radial-gradient(circle_at_82%_28%,rgba(79,70,229,0.2),transparent_42%),linear-gradient(120deg,rgba(0,32,35,0.72),rgba(0,0,0,0.92)_48%,rgba(0,5,9,1))]'} `}
      />

      <div className="absolute -right-[18vw] top-[8vh] h-[72vw] max-h-[980px] w-[72vw] max-w-[980px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={`spacetime-ripple-${i}`}
            animate={
              reduceMotion
                ? { opacity: 0.18 }
                : {
                    opacity: [0.04, i === 1 ? 0.34 : 0.2, 0.05],
                    scale: [0.98, 1.04, 0.99],
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: 7 + i * 1.5,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: 'easeInOut',
                  }
            }
            className={`absolute rounded-full border ${
              theme === 'light'
                ? i % 2 === 0
                  ? 'border-cyan-500/14 shadow-[0_0_34px_rgba(34,211,238,0.10)]'
                  : 'border-violet-500/14 shadow-[0_0_44px_rgba(139,92,246,0.10)]'
                : i % 2 === 0
                  ? 'border-cyan-300/20 shadow-[0_0_34px_rgba(34,211,238,0.14)]'
                  : 'border-indigo-400/24 shadow-[0_0_44px_rgba(99,102,241,0.18)]'
            }`}
            style={{
              inset: `${i * 9}%`,
            }}
          />
        ))}
        <div
          className={`absolute inset-[28%] rounded-full blur-2xl ${
            theme === 'light'
              ? 'bg-[radial-gradient(circle,rgba(91,210,255,0.16),rgba(139,92,246,0.10)_45%,transparent_70%)]'
              : 'bg-[radial-gradient(circle,rgba(91,210,255,0.18),rgba(61,75,230,0.1)_45%,transparent_70%)]'
          }`}
        />
      </div>

      <div className="absolute left-[8vw] top-[12vh] h-[42vw] max-h-[560px] w-[42vw] max-w-[560px] opacity-55">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={`soft-ripple-${i}`}
            animate={reduceMotion ? { opacity: 0.12 } : { opacity: [0.02, 0.14, 0.03] }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 9 + i * 2, repeat: Infinity, delay: i * 1.1 }
            }
            className={`absolute rounded-full border ${theme === 'light' ? 'border-cyan-500/12' : 'border-cyan-300/14'}`}
            style={{ inset: `${i * 15}%` }}
          />
        ))}
      </div>

      {/* Fixed Stars */}
      <div className="absolute inset-0">
        {fixedStars.map((star, i) => (
          <div
            key={`star-fix-${i}`}
            className={`absolute w-px h-px rounded-full ${theme === 'light' ? 'bg-cyan-700/35' : 'bg-white/40'}`}
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
                    opacity: [0, star.peakOpacity, 0],
                    scale: [0.35, 1, 0.45],
                    x: [0, star.x, 0],
                    y: [0, star.y, 0],
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: star.duration,
                    repeat: Infinity,
                    delay: star.delay,
                    repeatDelay: star.repeatDelay,
                  }
            }
            className={`absolute rounded-full blur-[1px] ${theme === 'light' ? 'bg-cyan-500' : 'bg-cyan-300'}`}
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
      <div
        className={`absolute inset-x-0 bottom-0 h-1/2 ${
          theme === 'light'
            ? 'bg-gradient-to-t from-white/80 via-cyan-50/28 to-transparent'
            : 'bg-gradient-to-t from-black via-black/42 to-transparent'
        }`}
      />
    </div>
  );
};

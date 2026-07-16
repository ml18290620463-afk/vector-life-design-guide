import React from 'react';
import { motion } from 'motion/react';
import { Theme } from '../types';
import { useMotionPreference } from '../hooks/useMotionPreference';
import { VectorSeededStarfieldBackdrop } from './VectorStarfieldBackdrop';

interface MasterLockBackdropProps {
  theme: Theme;
}

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

      <VectorSeededStarfieldBackdrop theme={theme} seed="master-lock" />

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

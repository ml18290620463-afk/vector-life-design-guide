import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { Theme } from '../types';
import { createSeededRandom } from '../lib/random';

interface MasterLockCardChromeProps {
  theme: Theme;
}

/**
 * Decorative chrome that wraps the MasterLock card: corner ripples,
 * twinkling stars, neon glow, paper grain, document-fold gradient and
 * cyberpunk corner accents.
 *
 * Pulled out of `MasterLock.tsx` as part of Phase 2 §2.i. Pure
 * decoration with `aria-hidden="true"` so screen readers skip it.
 * Memoised: the chrome only re-renders when `theme` changes.
 */
export const MasterLockCardChrome: React.FC<MasterLockCardChromeProps> = React.memo(({ theme }) => {
  // Seeded so the same panel always shows the same starscape (and
  // unrelated re-renders never reshuffle them).
  const cornerStars = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const random = createSeededRandom(`master-corner-${i}`);
        return {
          top: `${random() * 60}%`,
          right: `${random() * 60}%`,
          duration: 2.5 + random() * 2,
          delay: random() * 4,
        };
      }),
    [],
  );

  return (
    <div aria-hidden="true">
      {/* Cyberpunk Space-Time Ripples (Enhanced with Star-field & Rose) */}
      <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none z-40 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{
              duration: 8,
              repeat: Infinity,
              delay: i * 2.5,
              ease: 'linear',
            }}
            className={`absolute top-0 right-0 w-24 h-24 border-2 rounded-full -translate-y-1/2 translate-x-1/2 ${
              i === 1 && theme === 'dark'
                ? 'border-indigo-500/60 shadow-[0_0_30px_rgba(99,102,241,0.3),0_0_60px_rgba(99,102,241,0.1)]'
                : theme === 'light'
                  ? 'border-cyan-500/20'
                  : 'border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.4)]'
            }`}
          />
        ))}

        {/* Twinkling Stars in Background */}
        <div className="absolute inset-0 z-5">
          {cornerStars.map((star, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
              transition={{ duration: star.duration, repeat: Infinity, delay: star.delay }}
              className="absolute w-0.5 h-0.5 bg-white rounded-full opacity-60"
              style={{ top: star.top, right: star.right }}
            />
          ))}
        </div>

        {/* Spatial Tech Glow (Neon Cyan & Rose Mix) */}
        <div
          className={`absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2 opacity-60 z-10 ${theme === 'light' ? 'bg-cyan-200' : 'bg-cyan-500/40'}`}
        />
        {theme === 'dark' && (
          <motion.div
            animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.2, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute top-0 right-0 w-24 h-24 blur-[40px] rounded-full -translate-y-1/4 translate-x-1/4 z-11 bg-indigo-500/20 shadow-[0_0_40px_rgba(99,102,241,0.2)]"
          />
        )}

        {/* Corner Plate Overlay */}
        <div
          className={`absolute top-0 right-0 w-0 h-0 border-t-[50px] border-r-[50px] border-t-transparent z-40 ${theme === 'light' ? 'border-r-white/90' : 'border-r-black/80'}`}
        />
        <div
          className={`absolute top-0 right-0 w-px h-[70px] rotate-45 origin-top-right z-50 ${theme === 'light' ? 'bg-cyan-500/40' : 'bg-cyan-400/60 shadow-[0_0_10px_rgba(34,211,238,0.8)]'}`}
        />
      </div>

      {/* Background Pattern & Paper Grain */}
      <div
        className={`absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-multiply ${theme === 'light' ? 'bg-[url("https://www.transparenttextures.com/patterns/natural-paper.png")]' : 'bg-[url("https://www.transparenttextures.com/patterns/dark-matter.png")]'}`}
      />
      <div
        className={`absolute inset-0 opacity-[0.02] pointer-events-none ${theme === 'light' ? 'bg-[url("https://www.transparenttextures.com/patterns/gray-lines.png")]' : ''}`}
      />

      {/* Document Folding Effect (Subtle Line) */}
      <div
        className={`absolute inset-0 opacity-[0.03] pointer-events-none ${theme === 'light' ? 'bg-[linear-gradient(135deg,transparent_45%,#000_50%,transparent_55%)]' : 'bg-[linear-gradient(135deg,transparent_45%,#fff_50%,transparent_55%)]'}`}
      />

      {/* Cyber Accents */}
      <div
        className={`absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 ${theme === 'light' ? 'border-cyan-400' : 'border-cyan-500/50'}`}
      />
      <div
        className={`absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 ${theme === 'light' ? 'border-cyan-400' : 'border-cyan-500/50'}`}
      />
      <div
        className={`absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 ${theme === 'light' ? 'border-cyan-400' : 'border-cyan-500/50'}`}
      />
      <div
        className={`absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 ${theme === 'light' ? 'border-cyan-400' : 'border-cyan-500/50'}`}
      />
    </div>
  );
});

MasterLockCardChrome.displayName = 'MasterLockCardChrome';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Fingerprint, Scan } from 'lucide-react';
import type { DiaryEntry, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { TypewriterText } from './TypewriterText';
import { APP_VERSION } from '../constants';

interface RippleStar {
  top: string;
  right: string;
  duration: number;
  delay: number;
}

interface ViewerSealedPanelProps {
  theme: Theme;
  t: TranslationDictionary;
  entry: DiaryEntry;
  displayIdentity: string;
  viewState: 'sealed' | 'opening' | 'reading';
  decryptionPassword: string;
  setDecryptionPassword: (value: string) => void;
  decryptionError: string | null;
  biometricError: string | null;
  isScanning: boolean;
  lockoutUntil: number | null;
  isTimeLocked: boolean;
  timeLeft: { d: number; h: number; m: number; s: number } | null;
  rippleStars: readonly RippleStar[];
  onOpenLetter: () => void;
  onBack: () => void;
}

/**
 * The "letter envelope" view that the user sees before they have
 * authenticated against an entry. Renders the seal animation, the
 * password input, the time-lock countdown, the unlock button and the
 * inline error banner. Pulled out of `Viewer.tsx` so the viewer file
 * shrinks to its workflow logic.
 *
 * Pure stateless component — every interaction goes back through the
 * `useViewerAccess` hook owned by the parent.
 */
export const ViewerSealedPanel: React.FC<ViewerSealedPanelProps> = ({
  theme,
  t,
  entry,
  displayIdentity,
  viewState,
  decryptionPassword,
  setDecryptionPassword,
  decryptionError,
  biometricError,
  isScanning,
  lockoutUntil,
  isTimeLocked,
  timeLeft,
  rippleStars,
  onOpenLetter,
  onBack,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, scale: 1.1, filter: 'blur(30px)' }}
    transition={{ duration: 1.2 }}
    className={`fixed inset-0 z-50 flex items-center justify-center p-6 md:p-12 backdrop-blur-3xl overflow-y-auto transition-colors duration-1000 ${theme === 'light' ? 'bg-neutral-50/40' : 'bg-vector-onyx/40'}`}
  >
    {/* Data Stream Lines */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ left: '-100%' }}
          animate={{ left: '200%' }}
          transition={{
            duration: 10 + i * 2,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 3,
          }}
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent top-0"
          style={{
            top: `${20 * i}%`,
            transform: `rotate(${5 * (i % 2 === 0 ? 1 : -1)}deg)`,
          }}
        />
      ))}
    </div>

    <div className="relative w-full max-w-[380px] md:max-w-[420px] perspective-[3000px] z-10 px-4 md:px-0 my-auto">
      <motion.div
        whileHover={{
          x: [0, -1, 1, -1, 1, 0],
          rotate: [0, -0.5, 0.5, -0.5, 0],
          transition: { duration: 0.4 },
        }}
        whileTap={{
          scale: 0.98,
          x: [0, -2, 2, -2, 2, 0],
          transition: { duration: 0.2 },
        }}
        animate={
          viewState === 'opening'
            ? {
                rotateX: 110,
                rotateY: [0, 45, -45, 0],
                z: 800,
                opacity: 0,
                scale: [1, 2, 3],
                skewX: [0, 40, -40, 0],
                skewY: [0, -20, 20, 0],
                filter: ['blur(0px)', 'blur(20px)', 'blur(40px)'],
              }
            : {
                y: [0, -8, 0],
                rotateY: [-1, 1, -1],
                rotateX: [0.5, -0.5, 0.5],
              }
        }
        transition={
          viewState === 'opening'
            ? {
                duration: 2.5,
                ease: 'circIn',
                skewX: { duration: 1.2, repeat: 1 },
                skewY: { duration: 1.2, repeat: 1 },
              }
            : {
                y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
                rotateY: { duration: 12, repeat: Infinity, ease: 'easeInOut' },
                rotateX: { duration: 10, repeat: Infinity, ease: 'easeInOut' },
              }
        }
        className={`relative transition-all duration-1000 group rounded-sm ${theme === 'light' ? 'bg-vector-paper-cream shadow-[0_0_60px_color-mix(in_srgb,_var(--color-vector-cyan-brand)_10%,_transparent)] border border-cyan-500/20' : 'bg-neutral-950 border border-cyan-500/40 neon-border-cyan shadow-[0_0_90px_color-mix(in_srgb,_var(--color-cyan-500)_20%,_transparent),inset_0_0_40px_color-mix(in_srgb,_var(--color-cyan-500)_10%,_transparent)]'} ${viewState === 'opening' ? 'pointer-events-none' : ''}`}
      >
        {/* Back Button (Top Left Corner) */}
        <div className="absolute -top-4 -left-4 z-50">
          <button
            data-testid="viewer-back"
            onClick={onBack}
            aria-label={t.abort}
            className={`w-12 h-12 rounded-full border transition-all flex items-center justify-center group backdrop-blur-md shadow-lg ${theme === 'light' ? 'text-slate-400 border-slate-200 hover:text-slate-900 hover:border-slate-400 bg-white/80' : 'text-cyan-500/60 border-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/50 bg-black/60 shadow-[0_0_20px_color-mix(in_srgb,_var(--color-cyan-500)_10%,_transparent)] neon-border-cyan'}`}
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          </button>
        </div>

        {/* Cyberpunk Space-Time Ripples */}
        <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none z-40 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 3.5, opacity: 0 }}
              transition={{
                duration: 8,
                repeat: Infinity,
                delay: i * 2.5,
                ease: 'linear',
              }}
              className={`absolute top-0 right-0 w-24 h-24 border-2 rounded-full -translate-y-1/2 translate-x-1/2 ${
                i === 1 && theme === 'dark'
                  ? 'border-indigo-500/60 shadow-[0_0_30px_color-mix(in_srgb,_var(--color-indigo-500)_30%,_transparent)]'
                  : theme === 'light'
                    ? 'border-cyan-500/20'
                    : 'border-cyan-400/40 shadow-[0_0_15px_color-mix(in_srgb,_var(--color-cyan-400)_20%,_transparent)]'
              }`}
            />
          ))}

          {/* Background Twinkling Stars (behind ripples) */}
          <div className="absolute inset-x-0 top-0 h-full z-5">
            {rippleStars.map((star, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1, 0.5] }}
                transition={{
                  duration: star.duration,
                  repeat: Infinity,
                  delay: star.delay,
                  ease: 'easeInOut',
                }}
                className="absolute w-0.5 h-0.5 bg-white rounded-full bg-slate-200"
                style={{ top: star.top, right: star.right }}
              />
            ))}
          </div>

          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 z-10 ${theme === 'light' ? 'bg-cyan-200' : 'bg-cyan-500/30'}`}
          />
          <motion.div
            animate={{ opacity: [0.1, 0.5, 0.1], scale: [0.8, 1.3, 0.8] }}
            transition={{ duration: 4, repeat: Infinity, delay: 1 }}
            className="absolute top-0 right-0 w-28 h-28 blur-2xl rounded-full -translate-y-1/3 translate-x-1/3 z-11 bg-indigo-500/10 shadow-[0_0_40px_color-mix(in_srgb,_var(--color-indigo-500)_20%,_transparent)]"
          />

          {/* Static Tech Corner Plate */}
          <div
            className={`absolute top-0 right-0 w-0 h-0 border-t-[60px] border-r-[60px] border-t-transparent z-40 ${theme === 'light' ? 'border-r-white/80' : 'border-r-black/60 shadow-[-10px_10px_20px_color-mix(in_srgb,_black_50%,_transparent)]'}`}
          />
          <div
            className={`absolute top-0 right-0 w-px h-[85px] rotate-45 origin-top-right z-50 ${theme === 'light' ? 'bg-cyan-500/30' : 'bg-cyan-400/50 shadow-[0_0_10px_color-mix(in_srgb,_var(--color-cyan-400)_50%,_transparent)]'}`}
          />
        </div>

        {/* Background Pattern & Paper Grain */}
        <div
          className={`absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-multiply ${theme === 'light' ? 'bg-[url("https://www.transparenttextures.com/patterns/natural-paper.png")]' : 'bg-[url("https://www.transparenttextures.com/patterns/dark-matter.png")]'}`}
        />
        <div
          className={`absolute inset-0 opacity-[0.03] pointer-events-none ${theme === 'light' ? 'bg-[url("https://www.transparenttextures.com/patterns/gray-lines.png")]' : ''}`}
        />

        <div className="p-5 md:p-7 flex flex-col gap-4 md:gap-5 relative overflow-hidden min-h-[420px]">
          {/* Background Decoration & Paper Texture */}
          <div
            className={`absolute inset-0 pointer-events-none opacity-[0.05] ${theme === 'light' ? 'bg-[url("https://www.transparenttextures.com/patterns/handmade-paper.png")]' : 'bg-[url("https://www.transparenttextures.com/patterns/asfalt-dark.png")]'}`}
          ></div>

          {/* Clean Orderly Header Info Section */}
          <div className="flex flex-col gap-6 relative z-10 border-b border-black/[0.05] dark:border-white/[0.05] -mx-5 md:-mx-7 p-6 md:p-8 pt-10 md:pt-12 mb-6">
            <div
              className={`font-mono text-xs md:text-sm tracking-widest leading-loose ${theme === 'light' ? 'text-slate-600' : 'text-cyan-400'}`}
            >
              <TypewriterText
                text={`✦ 时空信件加载中  。。。\n来自 ${new Date(entry.createdAt).toLocaleDateString('zh-CN')} 信件\n信件主题：${entry.title}\n签收人：${displayIdentity}`}
                speed={60}
              />
            </div>
          </div>

          {/* Password Field */}
          {!isTimeLocked && (
            <div className="relative z-20 my-0.5 md:my-1 bg-black/[0.01] dark:bg-white/[0.01] p-3 md:p-4 border border-black/[0.03] dark:border-white/[0.03]">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-[1px] bg-cyan-500/40" />
                  <span className="text-[7.5px] font-mono opacity-30 uppercase tracking-[0.5em] text-center">
                    {t.securityCalibration}
                  </span>
                  <div className="w-3 h-[1px] bg-cyan-500/40" />
                </div>

                <div className="relative">
                  <input
                    autoFocus
                    type="password"
                    value={decryptionPassword}
                    onChange={(e) => setDecryptionPassword(e.target.value)}
                    placeholder="........"
                    aria-label={t.securityCalibration}
                    className={`w-full bg-transparent border-b py-3 font-mono text-xl outline-none transition-all text-center tracking-[1.1em] relative z-20 ${theme === 'light' ? 'border-slate-300 text-slate-900 focus:border-cyan-600' : 'border-white/10 text-white focus:border-cyan-500 shadow-[inset_0_0_40px_color-mix(in_srgb,_var(--color-cyan-500)_2%,_transparent)]'}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onOpenLetter();
                    }}
                  />
                  <div className="absolute inset-0 bg-cyan-500/5 blur-[40px] opacity-0 group-focus-within:opacity-100 transition-opacity" />
                </div>

                <div className="flex justify-center gap-2">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={
                        decryptionPassword.length > i
                          ? { scale: [1, 1.25, 1], opacity: 1 }
                          : { scale: 1, opacity: 0.2 }
                      }
                      className={`w-1 h-1 rounded-full ${theme === 'light' ? 'bg-slate-400' : 'bg-cyan-500'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {isTimeLocked && timeLeft && (
            <div className="relative z-10 flex flex-col items-center gap-10 py-6">
              <div className="flex gap-10">
                {[
                  { label: t.days, val: timeLeft.d },
                  { label: t.hrs, val: timeLeft.h },
                  { label: t.min, val: timeLeft.m },
                  { label: t.sec, val: timeLeft.s },
                ].map((segment, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span
                      className={`text-[8px] font-mono opacity-30 uppercase tracking-[0.3em] mb-3`}
                    >
                      {segment.label}
                    </span>
                    <div className="relative">
                      <span className="text-3xl font-black tracking-tighter opacity-90 font-mono">
                        {segment.val.toString().padStart(2, '0')}
                      </span>
                      <div className="absolute -inset-2 border border-cyan-500/10 rounded-sm" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-[1px] bg-indigo-500/20 shadow-[0_0_5px_color-mix(in_srgb,_var(--color-indigo-500)_20%,_transparent)]" />
                <span className="text-[10px] font-mono uppercase tracking-[0.6em] text-indigo-400 font-bold animate-pulse neon-glow-indigo drop-shadow-[0_0_5px_color-mix(in_srgb,_var(--color-indigo-500)_40%,_transparent)]">
                  {t.timeLock}
                </span>
                <div className="w-12 h-[1px] bg-indigo-500/20 shadow-[0_0_5px_color-mix(in_srgb,_var(--color-indigo-500)_20%,_transparent)]" />
              </div>
            </div>
          )}

          {(decryptionError || biometricError) && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-500/10 border border-indigo-500/30 p-2 text-[8px] text-vector-magenta font-mono text-center w-full uppercase tracking-widest mt-2 shadow-[0_0_15px_color-mix(in_srgb,_var(--color-vector-magenta)_10%,_transparent)] neon-glow-alert"
            >
              {biometricError || decryptionError}
            </motion.div>
          )}

          <div className="flex justify-center pt-4 relative z-10">
            <motion.button
              whileTap={{ scale: 0.94 }}
              disabled={viewState === 'opening' || !!lockoutUntil || isScanning || isTimeLocked}
              onClick={(e) => {
                e.stopPropagation();
                onOpenLetter();
              }}
              className="flex flex-col items-center gap-3 group/seal"
            >
              <div
                className={`relative w-20 h-20 rounded-full border flex items-center justify-center transition-all duration-1000 ${isTimeLocked ? 'opacity-20 grayscale' : 'group-hover/seal:border-cyan-400 group-hover/seal:bg-cyan-500/10 group-hover/seal:shadow-[0_0_50px_color-mix(in_srgb,_var(--color-cyan-500)_20%,_transparent)]'} ${theme === 'light' ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-white/[0.02]'}`}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-1.5 border border-dashed border-cyan-500/20 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-3 border border-dotted border-cyan-500/10 rounded-full"
                />

                {viewState === 'opening' || isScanning ? (
                  <Scan className="w-7 h-7 animate-pulse text-cyan-400" />
                ) : (
                  <Fingerprint
                    className={`w-8 h-8 transition-all duration-700 ${isTimeLocked ? 'opacity-20' : 'opacity-40 group-hover/seal:opacity-100 group-hover/seal:text-cyan-400 group-hover/seal:scale-110'}`}
                  />
                )}
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className={`text-[8px] font-mono font-black uppercase tracking-[0.8em] transition-all ${isTimeLocked ? 'opacity-10' : 'opacity-40 group-hover/seal:opacity-100 group-hover/seal:text-cyan-400'}`}
                >
                  {isTimeLocked ? t.locked : t.unlock || 'UNLOCK'}
                </span>
                <span className="text-[6px] font-mono opacity-20 uppercase tracking-widest">
                  {t.version} {APP_VERSION}
                </span>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  </motion.div>
);

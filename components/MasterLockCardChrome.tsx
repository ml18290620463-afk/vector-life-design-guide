import React from 'react';
import type { Theme } from '../types';

interface MasterLockCardChromeProps {
  theme: Theme;
}

/**
 * Decorative chrome that wraps the MasterLock card: water-like edge
 * glints, neon glow, paper grain and document-fold gradient.
 *
 * Pulled out of `MasterLock.tsx` as part of Phase 2 §2.i. Pure
 * decoration with `aria-hidden="true"` so screen readers skip it.
 * Memoised: the chrome only re-renders when `theme` changes.
 */
export const MasterLockCardChrome: React.FC<MasterLockCardChromeProps> = React.memo(({ theme }) => {
  return (
    <div aria-hidden="true">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(188,255,255,0.22),transparent_18%),radial-gradient(circle_at_84%_12%,rgba(123,109,255,0.18),transparent_24%),linear-gradient(115deg,rgba(255,255,255,0.1),transparent_18%,transparent_58%,rgba(0,200,232,0.08)_70%,transparent_88%)] opacity-70" />
      <div className="pointer-events-none absolute -left-24 top-12 h-[2px] w-[42%] -rotate-[8deg] bg-gradient-to-r from-transparent via-cyan-100/60 to-transparent shadow-[0_0_20px_rgba(125,211,252,0.55)]" />
      <div className="pointer-events-none absolute right-10 top-4 h-24 w-40 -rotate-12 rounded-full bg-cyan-200/8 blur-2xl" />

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

      {/* Fluid Edge Glints */}
      <div
        data-testid="fluid-glint"
        className={`absolute -left-9 top-[10%] h-36 w-56 -rotate-[7deg] rounded-[67%_33%_72%_28%/38%_58%_42%_62%] border-l border-t shadow-[0_0_24px_rgba(103,232,249,0.18)] ${theme === 'light' ? 'border-cyan-400/60' : 'border-cyan-200/40'} opacity-75`}
      />
      <div
        data-testid="fluid-glint"
        className={`absolute left-[38%] top-[3%] h-14 w-[42%] rotate-[2deg] rounded-[72%_28%_63%_37%/44%_56%_38%_62%] border-t shadow-[0_0_22px_rgba(103,232,249,0.16)] ${theme === 'light' ? 'border-cyan-400/55' : 'border-cyan-200/34'} opacity-70`}
      />
      <div
        data-testid="fluid-glint"
        className={`absolute -right-8 top-[18%] h-[46%] w-32 rotate-[4deg] rounded-[34%_66%_55%_45%/46%_38%_62%_54%] border-r shadow-[0_0_26px_rgba(103,232,249,0.16)] ${theme === 'light' ? 'border-cyan-400/55' : 'border-cyan-200/32'} opacity-70`}
      />
      <div
        data-testid="fluid-glint"
        className={`absolute bottom-[2%] left-[7%] h-24 w-[36%] rotate-[3deg] rounded-[58%_42%_70%_30%/36%_64%_42%_58%] border-b shadow-[0_0_24px_rgba(103,232,249,0.14)] ${theme === 'light' ? 'border-cyan-400/55' : 'border-cyan-200/30'} opacity-65`}
      />
      <div
        data-testid="fluid-glint"
        className={`absolute bottom-[7%] right-[13%] h-28 w-48 -rotate-[5deg] rounded-[42%_58%_36%_64%/60%_40%_66%_34%] border-b border-r shadow-[0_0_24px_rgba(103,232,249,0.16)] ${theme === 'light' ? 'border-cyan-400/60' : 'border-cyan-200/36'} opacity-72`}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[18%] top-[12%] h-px w-[48%] -rotate-[4deg] bg-gradient-to-r from-transparent via-cyan-100/42 to-transparent shadow-[0_0_18px_rgba(125,211,252,0.38)]"
      />
    </div>
  );
});

MasterLockCardChrome.displayName = 'MasterLockCardChrome';

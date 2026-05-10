import React from 'react';
import type { Theme } from '../types';

interface ArchiveVaultBackgroundProps {
  theme: Theme;
}

/**
 * Decorative bio-vault background: pin-stripe grid, radial vignette,
 * three floating bubbles, and the two matrix-style data-rain
 * gradients. Pulled out of `ArchiveVault.tsx` as part of Phase 2
 * §2.k. All layers are `pointer-events-none` and `aria-hidden="true"`.
 */
export const ArchiveVaultBackground: React.FC<ArchiveVaultBackgroundProps> = React.memo(
  ({ theme }) => (
    <div aria-hidden="true">
      <div
        className={`absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,_var(--color-cyan-500)_2%,_transparent)_1px,transparent_1px)] bg-[size:30px_30px] ${theme === 'light' ? 'opacity-10' : ''}`}
      />
      <div
        className={`absolute inset-0 ${theme === 'light' ? 'bg-[radial-gradient(circle_at_center,color-mix(in_srgb,_white_80%,_transparent),var(--color-vector-fog-light))]' : 'bg-[radial-gradient(circle_at_center,color-mix(in_srgb,_var(--color-slate-900)_80%,_transparent),var(--color-vector-night-deep))]'}`}
      />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute bottom-[10%] left-[10%] w-2 h-2 rounded-full ${theme === 'light' ? 'bg-cyan-500/20' : 'bg-cyan-500/10 shadow-[0_0_8px_color-mix(in_srgb,_var(--color-cyan-500)_20%,_transparent)]'}`}
        />
        <div
          className={`absolute bottom-[30%] left-[30%] w-4 h-4 rounded-full ${theme === 'light' ? 'bg-cyan-500/10' : 'bg-indigo-500/10'}`}
        />
        <div
          className={`absolute bottom-[70%] left-[70%] w-3 h-3 rounded-full ${theme === 'light' ? 'bg-cyan-500/20' : 'bg-vector-magenta/5 shadow-[0_0_10px_color-mix(in_srgb,_var(--color-vector-magenta-bright)_10%,_transparent)]'}`}
        />
      </div>

      <div
        className={`absolute top-0 left-10 w-[1px] h-full bg-gradient-to-b from-transparent to-transparent ${theme === 'light' ? 'via-cyan-500/10' : 'via-cyan-500/5'}`}
      />
      <div
        className={`absolute top-0 right-20 w-[1px] h-full bg-gradient-to-b from-transparent to-transparent ${theme === 'light' ? 'via-cyan-500/10' : 'via-green-500/20'}`}
      />
    </div>
  ),
);

ArchiveVaultBackground.displayName = 'ArchiveVaultBackground';

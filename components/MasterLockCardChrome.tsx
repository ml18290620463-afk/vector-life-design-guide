import React from 'react';
import type { Theme } from '../types';

interface MasterLockCardChromeProps {
  theme: Theme;
}

/** Quiet structural details for the lock card. */
export const MasterLockCardChrome: React.FC<MasterLockCardChromeProps> = React.memo(({ theme }) => (
  <div className="master-lock-card-chrome pointer-events-none absolute inset-0" aria-hidden="true" data-theme={theme}>
    <span
      data-testid="fluid-glint"
      className="absolute left-7 top-7 h-px w-16 bg-[var(--ds-border-strong)] opacity-70"
    />
    <span
      data-testid="fluid-glint"
      className="absolute bottom-7 right-7 h-px w-12 bg-[var(--ds-border)] opacity-80"
    />
  </div>
));

MasterLockCardChrome.displayName = 'MasterLockCardChrome';

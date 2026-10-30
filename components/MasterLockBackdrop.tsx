import React from 'react';
import { Theme } from '../types';

interface MasterLockBackdropProps {
  theme: Theme;
}

/**
 * A deliberately quiet foundation for the protected entry flow. Authentication
 * benefits from legibility and calm more than an ambient scene; its depth is
 * made from two stable surface tones instead of texture or motion.
 */
export const MasterLockBackdrop: React.FC<MasterLockBackdropProps> = ({ theme }) => (
  <div
    className="master-lock-backdrop absolute inset-0 pointer-events-none"
    aria-hidden="true"
    data-theme={theme}
  >
    <div className="absolute inset-0 bg-[var(--ds-page)]" />
  </div>
);

import { useCallback, useState } from 'react';

interface UseDashboardWipeFlowOptions {
  /**
   * Performs the actual data wipe — typically threaded straight from
   * `App` → `Dashboard` so the caller doesn't have to read storage.
   */
  onWipeData: () => void;
  /**
   * Optional close-modal callback fired after a successful wipe so the
   * Settings panel collapses back to the dashboard surface.
   */
  onAfterWipe?: () => void;
}

export interface DashboardWipeFlowState {
  /** True while the destructive section is expanded inside Settings. */
  wipeMode: boolean;
  setWipeMode: (next: boolean) => void;
  /** Controlled "type DELETE" confirmation field. */
  wipeInput: string;
  setWipeInput: (next: string) => void;
  /** Validates the input and triggers the wipe + close cascade. */
  handleWipeConfirm: () => void;
}

/**
 * Owns the destructive-wipe confirmation state that previously lived
 * inline in Dashboard.tsx. The contract intentionally matches the
 * SettingsWipeSection prop shape so the Dashboard → SettingsPanel
 * adapter can spread the hook return directly.
 *
 * The hook does NOT auto-clear `wipeInput` after a wipe because
 * `onWipeData` typically tears down the entire data layer — keeping
 * the field controlled simply lets the parent decide on remount.
 *
 * Pulled out as part of Phase 2 §2.h tail (after VaultContent /
 * DashboardFooter / useClickOutside) so Dashboard.tsx can clear the
 * 350-LOC bar.
 */
export const useDashboardWipeFlow = ({
  onWipeData,
  onAfterWipe,
}: UseDashboardWipeFlowOptions): DashboardWipeFlowState => {
  const [wipeMode, setWipeMode] = useState(false);
  const [wipeInput, setWipeInput] = useState('');

  const handleWipeConfirm = useCallback(() => {
    if (wipeInput !== 'DELETE') return;
    onWipeData();
    onAfterWipe?.();
    setWipeMode(false);
  }, [wipeInput, onWipeData, onAfterWipe]);

  return { wipeMode, setWipeMode, wipeInput, setWipeInput, handleWipeConfirm };
};

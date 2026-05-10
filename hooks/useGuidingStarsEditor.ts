import { useCallback, useEffect, useState } from 'react';
import type { Language } from '../types';
import { GUIDING_STAR_DEFAULTS } from '../constants';

export interface UseGuidingStarsEditorArgs {
  /** Persisted custom + default directory of guiding stars. */
  guidingStars: string[];
  /** Persisted user-selected stars (max `maxSelected`). */
  selectedStars: string[];
  /** Active UI language; controls which preset-defaults are merged in. */
  language: Language;
  /** Whether the parent settings drawer is currently open. */
  showSettings: boolean;
  /** Hard cap on selectable stars; UX surfaces a warning when exceeded. */
  maxSelected?: number;
  /** Called when the user tries to exceed `maxSelected`. */
  onLimitExceeded?: (message: string) => void;
  /** Localised message shown when `maxSelected` is hit. */
  limitMessage: string;
  /** Persist a new directory of guiding stars. */
  onSaveGuidingStars: (stars: string[]) => void;
  /** Persist the new selection of stars. */
  onSaveSelectedStars: (stars: string[]) => void;
}

export interface GuidingStarsEditor {
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  tempDirectory: string[];
  tempSelected: string[];
  customStarName: string;
  setCustomStarName: (value: string) => void;
  toggleTempStar: (star: string) => void;
  handleDeleteCustomStar: (star: string) => void;
  handleAddCustomStar: () => void;
  handleSaveStars: () => void;
}

/**
 * Owns the Settings → Guiding Stars editor. Three pieces of local state
 * (`tempDirectory`, `tempSelected`, `customStarName`) plus a couple of
 * derived helpers used to live inline in `Dashboard.tsx`; pulled out
 * here so the dashboard composes rather than micromanages.
 *
 * The reset effect rebuilds `tempDirectory` / `tempSelected` from the
 * persisted values whenever the settings drawer closes — same behaviour
 * as the original inline `useEffect` so an in-progress edit is
 * discarded when the user exits the drawer without saving.
 */
export const useGuidingStarsEditor = ({
  guidingStars,
  selectedStars,
  language,
  showSettings,
  maxSelected = 3,
  onLimitExceeded,
  limitMessage,
  onSaveGuidingStars,
  onSaveSelectedStars,
}: UseGuidingStarsEditorArgs): GuidingStarsEditor => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempDirectory, setTempDirectory] = useState<string[]>(() => {
    const defaults = GUIDING_STAR_DEFAULTS[language] || [];
    return Array.from(new Set([...guidingStars, ...defaults]));
  });
  const [tempSelected, setTempSelected] = useState<string[]>(selectedStars);
  const [customStarName, setCustomStarName] = useState('');

  // Whenever the settings drawer closes, snap temp state back to the
  // persisted values so the next opening starts from a clean slate.
  // We compare arrays by content (join) to avoid the "new array reference
  // every render → infinite reset loop" trap that bit `useMorningStarPipeline`
  // in Phase 2 §2.b.
  const guidingKey = guidingStars.join('|');
  const selectedKey = selectedStars.join('|');
  useEffect(() => {
    if (!showSettings) {
      setIsEditing(false);
      const defaults = GUIDING_STAR_DEFAULTS[language] || [];
      setTempDirectory(Array.from(new Set([...guidingStars, ...defaults])));
      setTempSelected(selectedStars);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSettings, guidingKey, selectedKey, language]);

  const toggleTempStar = useCallback(
    (star: string) => {
      setTempSelected((prev) => {
        if (prev.includes(star)) return prev.filter((s) => s !== star);
        if (prev.length < maxSelected) return [...prev, star];
        onLimitExceeded?.(limitMessage);
        return prev;
      });
    },
    [limitMessage, maxSelected, onLimitExceeded],
  );

  const handleDeleteCustomStar = useCallback((star: string) => {
    setTempDirectory((prev) => prev.filter((s) => s !== star));
    setTempSelected((prev) => prev.filter((s) => s !== star));
  }, []);

  const handleAddCustomStar = useCallback(() => {
    const trimmed = customStarName.trim();
    if (!trimmed) return;

    setTempDirectory((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setTempSelected((prev) => {
      if (prev.includes(trimmed)) return prev;
      if (prev.length < maxSelected) return [...prev, trimmed];
      onLimitExceeded?.(limitMessage);
      return prev;
    });
    setCustomStarName('');
  }, [customStarName, limitMessage, maxSelected, onLimitExceeded]);

  const handleSaveStars = useCallback(() => {
    onSaveGuidingStars(tempDirectory);
    onSaveSelectedStars(tempSelected);
    setIsEditing(false);
  }, [onSaveGuidingStars, onSaveSelectedStars, tempDirectory, tempSelected]);

  return {
    isEditing,
    setIsEditing,
    tempDirectory,
    tempSelected,
    customStarName,
    setCustomStarName,
    toggleTempStar,
    handleDeleteCustomStar,
    handleAddCustomStar,
    handleSaveStars,
  };
};

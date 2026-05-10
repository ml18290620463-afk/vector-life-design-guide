import React from 'react';
import { Brain, Mail, Sparkles } from 'lucide-react';
import type { CustomPersona, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

/**
 * Phase 4.5 §E follow-up (L1) — `MemoirsPickerSection`
 *
 * Settings-mounted picker that lists every Memoir-kind custom
 * persona and lets the user open either:
 *   - the **Memory Management Panel** (Phase 4 W3, with the F2
 *     cascade-delete CTA), or
 *   - the **Letter History Panel** (Phase 4.5 follow-up F1).
 *
 * The picker is the "missing entry point" the F1 / F2 sprints
 * called out as future work — both panels were built + tested in
 * isolation but never reachable from a real user-facing surface.
 *
 * Why a section, not a modal: the picker is informational + thin
 * (one row per memoir, two CTAs per row). Putting it inside the
 * Settings drawer (a) avoids one more z-index layer and (b)
 * matches the "Settings owns the persona library audit surface"
 * mental model from §4.b-3 K1 (`TrustedDevicesPanel` is a
 * separate modal because it deals with cross-device security; the
 * memoir picker is a per-memoir housekeeping surface, so it lives
 * inline).
 *
 * Empty state: hidden entirely when the user has no Memoirs yet
 * (we avoid the "0 memoirs" placeholder because it adds noise to
 * Settings for the majority who never use the feature). The
 * Memoir Builder remains the discovery path for the feature; this
 * picker only surfaces AFTER at least one Memoir exists.
 */

interface MemoirsPickerSectionProps {
  theme: Theme;
  t: TranslationDictionary;
  /** Full custom-persona list. The section filters to `kind ===
   *  'memoir'` internally so the parent passes the same array it
   *  uses elsewhere. */
  personas: readonly CustomPersona[];
  /** Open the memory management panel for the picked memoir id. */
  onOpenMemories: (memoirId: string) => void;
  /** Open the letter history panel for the picked memoir id. */
  onOpenLetters: (memoirId: string) => void;
}

export const MemoirsPickerSection: React.FC<MemoirsPickerSectionProps> = ({
  theme,
  t,
  personas,
  onOpenMemories,
  onOpenLetters,
}) => {
  const memoirs = personas.filter((p) => p.kind === 'memoir');
  if (memoirs.length === 0) return null;

  const surface =
    theme === 'light' ? 'bg-amber-50/40 border-amber-200' : 'bg-amber-500/5 border-amber-500/30';
  const headingTone = theme === 'light' ? 'text-amber-900/80' : 'text-amber-200/80';
  const subtle = theme === 'light' ? 'text-amber-900/70' : 'text-amber-200/70';
  const rowSurface =
    theme === 'light' ? 'bg-white border-amber-200' : 'bg-vector-night-deep/40 border-amber-500/20';
  const ctaTone =
    theme === 'light'
      ? 'bg-white border-amber-200 hover:border-amber-300 text-amber-900'
      : 'bg-vector-night-deep/40 border-amber-500/30 hover:border-amber-500/50 text-amber-200';

  return (
    <div
      className={`flex flex-col gap-2 border rounded-lg p-3 ${surface}`}
      data-testid="settings-memoirs-picker"
    >
      <p
        className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 ${headingTone}`}
      >
        <Sparkles className="w-3 h-3" aria-hidden="true" />
        {(t.memoirsPickerTitle as string) ?? 'Memoirs (心象)'}
      </p>
      <p className={`text-[10px] leading-relaxed ${subtle}`}>
        {(t.memoirsPickerSubtitle as string) ??
          'Audit a memoir\u2019s memory bank or its letter history. Deleting a memoir from inside the Memories panel also clears its letters.'}
      </p>
      <ul className="flex flex-col gap-2 mt-1">
        {memoirs.map((memoir) => (
          <li
            key={memoir.id}
            className={`flex items-center gap-2 p-2 rounded-md border ${rowSurface}`}
            data-testid={`settings-memoirs-picker-row-${memoir.id}`}
          >
            <p
              className={`flex-1 text-[12px] truncate font-bold ${theme === 'light' ? 'text-amber-900' : 'text-amber-200'}`}
            >
              {memoir.name}
            </p>
            <button
              type="button"
              onClick={() => onOpenMemories(memoir.id)}
              className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md border transition-colors ${ctaTone}`}
              aria-label={
                (t.memoirsPickerOpenMemoriesAria as string | undefined)?.replace(
                  '{name}',
                  memoir.name,
                ) ?? `Open memories for ${memoir.name}`
              }
              data-testid={`settings-memoirs-picker-memories-${memoir.id}`}
            >
              <Brain className="w-3 h-3" aria-hidden="true" />
              {(t.memoirsPickerMemories as string) ?? 'Memories'}
            </button>
            <button
              type="button"
              onClick={() => onOpenLetters(memoir.id)}
              className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md border transition-colors ${ctaTone}`}
              aria-label={
                (t.memoirsPickerOpenLettersAria as string | undefined)?.replace(
                  '{name}',
                  memoir.name,
                ) ?? `Open letters for ${memoir.name}`
              }
              data-testid={`settings-memoirs-picker-letters-${memoir.id}`}
            >
              <Mail className="w-3 h-3" aria-hidden="true" />
              {(t.memoirsPickerLetters as string) ?? 'Letters'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

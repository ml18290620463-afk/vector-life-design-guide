import React, { useId, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Brain, Heart, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import type { CustomPersona, Memory, MemoryCategory, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { MEMORY_LIMITS, detectUnsafeMemoryBody } from '../services/memoryService';
import { halfLifeRemaining, salienceTier, type SalienceTier } from '../services/memoryDecay';

interface MemoryManagementPanelProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  t: TranslationDictionary;
  /** Memoir whose memories are being managed. Title bar uses
   *  `memoir.name`; the panel scopes its list to memoir.id. */
  memoir: CustomPersona;
  /** Live (non-soft-deleted) memory list scoped to this memoir.
   *  The parent (Settings panel) typically passes
   *  `memories.filter(m => m.memoirId === memoir.id && !m.deletedAt)`. */
  memories: readonly Memory[];
  /** CRUD callbacks wired through `useMemoryStore` by the parent. */
  onUpdateMemory: (
    id: string,
    patch: { body?: string; category?: MemoryCategory },
  ) => Promise<void> | void;
  /** Soft delete (default) — memory enters the 30-day recycle bin. */
  onDeleteMemory: (id: string) => Promise<void> | void;
  /** Wipe every memory belonging to the memoir. Confirmation lives
   *  inside the panel (a two-step "tap to confirm" pattern) so the
   *  parent never mistakenly invokes it without user intent. */
  onClearAll: () => Promise<void> | void;
  /**
   * Phase 4 W4 §2.5 — recycle-bin tab plumbing. Optional so legacy
   * callers (Storybook stories pre-W4) still compile; when omitted
   * the recycle-bin tab is hidden.
   */
  recycleBin?: readonly Memory[];
  onRestoreMemory?: (id: string) => Promise<void> | void;
  onHardDeleteMemory?: (id: string) => Promise<void> | void;
  /** Phase 4 W4 §2.3 — capacity ceiling for the live count chip.
   *  Optional; falls back to `Infinity` (no chip) when omitted. */
  capacity?: number;
  /**
   * Phase 4.5 follow-ups (F2) — cascade-delete the entire memoir
   * (the persona itself + all memories + all letters). Two-step
   * confirmation lives inside the panel (mirrors `onClearAll`).
   * Optional so legacy callers compile; when omitted the
   * "delete memoir" footer button is hidden entirely.
   */
  onCascadeDeleteMemoir?: () => Promise<void> | void;
}

/**
 * Phase 4 Week 3 Day 5 — `MemoryManagementPanel`
 *
 * The user-facing inspector for a Memoir's long-term memory bank.
 * Built per [`docs/product-vision-2026Q2.md`](../docs/product-vision-2026Q2.md)
 * §5.1.B "Memory Management" requirement:
 *
 *   - **View**: every memory the LLM has stored, grouped by category.
 *   - **Edit**: open an inline editor, re-run the safety check on
 *     submit, surface the failure reason as an inline status.
 *   - **Delete**: per-memory destructive action (no soft-delete in
 *     v1 — backups carry the wipe forward immediately).
 *   - **Clear all**: two-step confirmation (tap once to arm, tap
 *     again within 5 seconds to execute) — pattern borrowed from
 *     `SettingsWipeSection`.
 *   - **Safety card**: a static panel rendered ABOVE the list that
 *     reminds the user the memoir is their memory of the person and
 *     not professional support, plus a regional hotline pointer.
 *
 * Privacy posture: the panel never sends memory bodies anywhere —
 * all CRUD flows through the parent's local IDB store via the
 * `onUpdateMemory` / `onDeleteMemory` / `onClearAll` callbacks.
 */
export const MemoryManagementPanel: React.FC<MemoryManagementPanelProps> = ({
  open,
  onClose,
  theme,
  t,
  memoir,
  memories,
  onUpdateMemory,
  onDeleteMemory,
  onClearAll,
  recycleBin,
  onRestoreMemory,
  onHardDeleteMemory,
  capacity,
  onCascadeDeleteMemoir,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Two-step "armed → confirm" guard for the destructive wipe.
  const [wipeArmedAt, setWipeArmedAt] = useState<number | null>(null);
  // Phase 4 W4 — tab toggle between live memories and the recycle bin.
  const [tab, setTab] = useState<'live' | 'recycle'>('live');
  // Stable `now` per render-pass so every salience computation in
  // the same pass agrees. We *want* the recompute to fire when the
  // memory list or recycle bin changes, so we list them as deps
  // even though `Date.now()` doesn't read them. The lint rule sees
  // this as "unused deps" — disable inline rather than rewriting,
  // because the intent (reseed on data change) is the readable one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => Date.now(), [memories, recycleBin]);

  const headerId = useId();
  const recycleBinAvailable =
    Array.isArray(recycleBin) && (recycleBin?.length ?? 0) > 0 && !!onRestoreMemory;

  // Phase 4.5 follow-ups (F2) — separate two-step state for the
  // cascade-delete-memoir CTA. Lives ABOVE the `if (!open) return null`
  // early return so the rules-of-hooks ordering stays stable.
  const [cascadeArmedAt, setCascadeArmedAt] = useState<number | null>(null);

  // Group memories by category for a friendlier render.
  const grouped = useMemo(() => {
    const buckets: Record<MemoryCategory, Memory[]> = {
      milestone: [],
      relationship: [],
      fact: [],
      emotion: [],
    };
    for (const m of memories) {
      buckets[m.category].push(m);
    }
    return buckets;
  }, [memories]);

  if (!open) return null;

  const surface =
    theme === 'light'
      ? 'bg-vector-paper-white border-slate-200 text-vector-ink-strong'
      : 'bg-vector-night-navy border-cyan-950/60 text-cyan-100';
  const subtleText = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';
  const cardSurface =
    theme === 'light'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-amber-500/5 border-amber-500/30 text-amber-200';
  const inputClass = `w-full p-2 rounded-md border ${theme === 'light' ? 'bg-white border-slate-300 text-vector-ink-strong' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100'} focus:outline-none focus:border-vector-cyan-neon/60`;

  const categoryLabels: Record<MemoryCategory, string> = {
    milestone: (t.memoryCategoryMilestone as string) ?? 'Milestones',
    relationship: (t.memoryCategoryRelationship as string) ?? 'Relationships',
    fact: (t.memoryCategoryFact as string) ?? 'Facts',
    emotion: (t.memoryCategoryEmotion as string) ?? 'Emotions',
  };

  const startEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setDraftBody(memory.body);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftBody('');
    setEditError(null);
  };

  const saveEdit = async () => {
    const trimmed = draftBody.trim();
    if (trimmed.length === 0) {
      setEditError((t.memoryEditEmpty as string) ?? 'Memory body cannot be empty.');
      return;
    }
    const safety = detectUnsafeMemoryBody(trimmed);
    if (!safety.safe) {
      setEditError(
        ((t.memoryEditUnsafe as string) ??
          'This memory looks like it contains private contact info — remove it before saving.') +
          ` (${safety.reason})`,
      );
      return;
    }
    setSaving(true);
    try {
      await onUpdateMemory(editingId!, { body: trimmed });
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllClick = () => {
    const now = Date.now();
    if (wipeArmedAt && now - wipeArmedAt < 5000) {
      void onClearAll();
      setWipeArmedAt(null);
      return;
    }
    setWipeArmedAt(now);
  };

  const handleCascadeDeleteClick = () => {
    if (!onCascadeDeleteMemoir) return;
    const now = Date.now();
    if (cascadeArmedAt && now - cascadeArmedAt < 5000) {
      void onCascadeDeleteMemoir();
      setCascadeArmedAt(null);
      onClose();
      return;
    }
    setCascadeArmedAt(now);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headerId}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.25 }}
          className={`relative w-full max-w-3xl border rounded-2xl p-8 my-12 shadow-2xl ${surface}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close ?? 'Close'}
            className="absolute top-4 right-4 p-2 rounded-md hover:bg-cyan-500/10 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-vector-cyan-neon" aria-hidden="true" />
              <h2 id={headerId} className="text-xl font-bold tracking-wide">
                {(t.memoryPanelTitle as string) ?? 'Memories'} · {memoir.name}
              </h2>
            </div>
            {/* Phase 4 W4 §2.3 — capacity chip showing live count vs cap. */}
            {typeof capacity === 'number' && capacity > 0 && (
              <span
                className={`text-[10px] font-mono px-2 py-1 rounded border ${theme === 'light' ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'}`}
                aria-label={
                  (t.memoryPanelCapacityAria as string) ?? 'Memories used out of plan capacity'
                }
                data-testid="memory-capacity-chip"
              >
                {memories.length} / {capacity}
              </span>
            )}
          </div>
          <p className={`text-xs leading-relaxed ${subtleText} mb-4`}>
            {(t.memoryPanelSubtitle as string) ??
              'These are the things this memoir remembers about you. Anything you remove disappears immediately and is excluded from your next backup.'}
          </p>

          {/* Phase 4 W4 §2.5 — Live / Recycle bin tab switcher.
              Hidden when no recycle-bin handlers were wired (legacy
              callers / Storybook). */}
          {recycleBinAvailable && (
            <div
              className="flex items-center gap-1 mb-4"
              role="tablist"
              aria-label={(t.memoryPanelTabsAria as string) ?? 'Memory views'}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'live'}
                onClick={() => setTab('live')}
                className={`text-[11px] uppercase tracking-widest px-3 py-1 rounded-md border transition-colors ${tab === 'live' ? (theme === 'light' ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200') : `${subtleText} border-transparent`}`}
              >
                {(t.memoryPanelTabLive as string) ?? 'Live'} ({memories.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'recycle'}
                onClick={() => setTab('recycle')}
                className={`text-[11px] uppercase tracking-widest px-3 py-1 rounded-md border transition-colors ${tab === 'recycle' ? (theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/30 text-amber-200') : `${subtleText} border-transparent`}`}
              >
                {(t.memoryPanelTabRecycle as string) ?? 'Recycle bin'} ({recycleBin?.length ?? 0})
              </button>
            </div>
          )}

          {/* Safety / wellness reminder card. Copy intentionally
              short — the modal is for memory management, not
              triage. The hotline pointer is bilingual but locale-
              specific copy lives in the i18n bundle. */}
          <div
            className={`flex items-start gap-3 p-3 rounded-md border mb-6 ${cardSurface}`}
            role="note"
          >
            <Heart className="w-4 h-4 mt-0.5" aria-hidden="true" />
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold mb-1">
                {(t.memoryPanelSafetyTitle as string) ?? 'A gentle reminder'}
              </p>
              <p>
                {(t.memoryPanelSafetyBody as string) ??
                  'A memoir is your own memory of someone — it is not the person, and it cannot replace professional support if you are struggling.'}
              </p>
              <p className="mt-1">
                {(t.memoryPanelSafetyHotline as string) ??
                  'If you are in crisis, please reach out to someone you trust or a regional hotline.'}
              </p>
            </div>
          </div>

          {tab === 'live' && memories.length === 0 ? (
            <div className={`text-center text-sm py-12 ${subtleText}`} role="status">
              {(t.memoryPanelEmpty as string) ??
                'No memories yet. The next time you talk with this memoir, things you discuss may be remembered here.'}
            </div>
          ) : tab === 'live' ? (
            <div className="flex flex-col gap-6">
              {(Object.keys(grouped) as MemoryCategory[])
                .filter((cat) => grouped[cat].length > 0)
                .map((cat) => (
                  <div key={cat}>
                    <h3
                      className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${subtleText}`}
                    >
                      {categoryLabels[cat]}
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {grouped[cat].map((memory) => (
                        <li
                          key={memory.id}
                          className={`p-3 rounded-md border ${theme === 'light' ? 'border-slate-200' : 'border-cyan-950/60'}`}
                        >
                          {editingId === memory.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                rows={3}
                                value={draftBody}
                                maxLength={MEMORY_LIMITS.body}
                                onChange={(e) => setDraftBody(e.target.value)}
                                disabled={saving}
                                className={inputClass}
                                aria-label={(t.memoryEditAria as string) ?? 'Edit memory'}
                              />
                              <div className={`text-[10px] font-mono text-right ${subtleText}`}>
                                {draftBody.length} / {MEMORY_LIMITS.body}
                              </div>
                              {editError && (
                                <p
                                  role="status"
                                  className="flex items-center gap-1 text-[11px] text-rose-400"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                                  {editError}
                                </p>
                              )}
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  className={`text-[11px] uppercase tracking-widest hover:text-vector-cyan-neon ${subtleText} disabled:opacity-30`}
                                >
                                  {t.cancel ?? 'Cancel'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void saveEdit()}
                                  disabled={saving}
                                  className="text-[11px] uppercase tracking-widest text-vector-cyan-neon disabled:opacity-30"
                                  aria-label={(t.memoryEditSave as string) ?? 'Save memory'}
                                >
                                  {saving
                                    ? ((t.memoryEditSaving as string) ?? 'Saving…')
                                    : ((t.memoryEditSave as string) ?? 'Save')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 flex flex-col gap-1">
                                <p className="text-sm leading-relaxed">{memory.body}</p>
                                {/* Phase 4 W4 §2.1 — salience tier badge.
                                    Tooltip surfaces the half-life so users
                                    can reason about decay. */}
                                <SalienceBadge
                                  tier={salienceTier(memory, now)}
                                  halfLifeDays={halfLifeRemaining(memory, now)}
                                  theme={theme}
                                  t={t}
                                />
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEdit(memory)}
                                  className={`p-1.5 rounded hover:bg-cyan-500/10 ${subtleText}`}
                                  aria-label={
                                    ((t.memoryEditAction as string) ?? 'Edit memory') +
                                    ` (${memory.id})`
                                  }
                                  title={(t.memoryEditAction as string) ?? 'Edit'}
                                >
                                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onDeleteMemory(memory.id)}
                                  className="p-1.5 rounded hover:bg-rose-500/10 text-rose-400"
                                  aria-label={
                                    ((t.memoryDeleteAction as string) ?? 'Delete memory') +
                                    ` (${memory.id})`
                                  }
                                  title={(t.memoryDeleteAction as string) ?? 'Delete'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            // Phase 4 W4 §2.5 — Recycle bin tab.
            <RecycleBinView
              memories={recycleBin ?? []}
              theme={theme}
              t={t}
              subtleText={subtleText}
              onRestore={(id) => {
                if (onRestoreMemory) void onRestoreMemory(id);
              }}
              onHardDelete={(id) => {
                if (onHardDeleteMemory) void onHardDeleteMemory(id);
              }}
            />
          )}

          {tab === 'live' && memories.length > 0 && (
            <div className="flex items-center justify-end mt-6 pt-4 border-t border-rose-500/20">
              <button
                type="button"
                onClick={handleClearAllClick}
                className="text-[11px] uppercase tracking-widest text-rose-400 hover:text-rose-300"
                aria-label={(t.memoryClearAllAria as string) ?? 'Clear all memories'}
              >
                {wipeArmedAt && Date.now() - wipeArmedAt < 5000
                  ? ((t.memoryClearAllConfirm as string) ?? 'Tap again to confirm')
                  : ((t.memoryClearAll as string) ?? 'Clear all memories')}
              </button>
            </div>
          )}

          {/* Phase 4.5 follow-ups (F2) — cascade-delete-memoir CTA.
              Lives below the clear-all action with an extra border
              + danger styling so users perceive it as a heavier
              destructive action than "just wipe the memories". */}
          {tab === 'live' && onCascadeDeleteMemoir && (
            <div
              className="flex flex-col gap-1 mt-3 pt-3 border-t border-rose-500/30"
              data-testid="memory-panel-cascade-delete"
            >
              <button
                type="button"
                onClick={handleCascadeDeleteClick}
                className="self-end text-[11px] uppercase tracking-widest text-rose-500 hover:text-rose-400 font-bold"
                aria-label={
                  (t.memoryCascadeDeleteAria as string) ??
                  'Delete this memoir, its memories, and its letters'
                }
              >
                {cascadeArmedAt && Date.now() - cascadeArmedAt < 5000
                  ? ((t.memoryCascadeDeleteConfirm as string) ??
                    'Tap again — this removes the memoir AND its letters')
                  : ((t.memoryCascadeDelete as string) ?? 'Delete this memoir entirely')}
              </button>
              <p className="text-[10px] text-rose-400/70 self-end max-w-[24rem] text-right">
                {(t.memoryCascadeDeleteHint as string) ??
                  'Removes the memoir record, every memory, and every pending letter to it. This cannot be undone.'}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Phase 4 W4 helpers — salience badge + recycle bin view             */
/* ------------------------------------------------------------------ */

const TIER_STYLES: Record<
  SalienceTier,
  { light: string; dark: string; labelKey: string; fallback: string }
> = {
  fresh: {
    light: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    dark: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
    labelKey: 'memorySalienceFresh',
    fallback: 'Fresh',
  },
  warm: {
    light: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    dark: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200',
    labelKey: 'memorySalienceWarm',
    fallback: 'Warm',
  },
  cool: {
    light: 'bg-slate-50 border-slate-200 text-slate-600',
    dark: 'bg-slate-500/10 border-slate-500/30 text-slate-300',
    labelKey: 'memorySalienceCool',
    fallback: 'Cool',
  },
  fading: {
    light: 'bg-amber-50 border-amber-200 text-amber-700',
    dark: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
    labelKey: 'memorySalienceFading',
    fallback: 'Fading',
  },
};

const SalienceBadge: React.FC<{
  tier: SalienceTier;
  halfLifeDays: number;
  theme: Theme;
  t: TranslationDictionary;
}> = ({ tier, halfLifeDays, theme, t }) => {
  const style = TIER_STYLES[tier];
  const label = (t[style.labelKey] as string) ?? style.fallback;
  const tooltipTpl =
    (t.memorySalienceTooltip as string) ?? 'Half-life: ~{days} days at current strength.';
  const tooltip = Number.isFinite(halfLifeDays)
    ? tooltipTpl.replace('{days}', String(halfLifeDays))
    : '';
  return (
    <span
      className={`self-start text-[10px] font-mono px-2 py-0.5 rounded border ${theme === 'light' ? style.light : style.dark}`}
      title={tooltip}
      data-testid={`salience-badge-${tier}`}
    >
      {label}
    </span>
  );
};

const RecycleBinView: React.FC<{
  memories: readonly Memory[];
  theme: Theme;
  t: TranslationDictionary;
  subtleText: string;
  onRestore: (id: string) => void;
  onHardDelete: (id: string) => void;
}> = ({ memories, theme, t, subtleText, onRestore, onHardDelete }) => {
  if (memories.length === 0) {
    return (
      <div className={`text-center text-sm py-12 ${subtleText}`} role="status">
        {(t.memoryRecycleEmpty as string) ??
          'Recycle bin is empty. Memories you delete reappear here for 30 days before being purged.'}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-[11px] leading-relaxed ${subtleText} mb-2`}>
        {(t.memoryRecycleSubtitle as string) ??
          'Restore a memory to bring it back into the recall pool, or delete forever to remove it now.'}
      </p>
      <ul className="flex flex-col gap-2">
        {memories.map((m) => (
          <li
            key={m.id}
            className={`p-3 rounded-md border ${theme === 'light' ? 'border-slate-200 bg-slate-50/50' : 'border-cyan-950/60 bg-vector-night-deep/20'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`text-sm leading-relaxed flex-1 ${subtleText} line-through opacity-80`}>
                {m.body}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onRestore(m.id)}
                  className={`p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400`}
                  aria-label={
                    ((t.memoryRestoreAction as string) ?? 'Restore memory') + ` (${m.id})`
                  }
                  title={(t.memoryRestoreAction as string) ?? 'Restore'}
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onHardDelete(m.id)}
                  className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400"
                  aria-label={
                    ((t.memoryHardDeleteAction as string) ?? 'Delete forever') + ` (${m.id})`
                  }
                  title={(t.memoryHardDeleteAction as string) ?? 'Delete forever'}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

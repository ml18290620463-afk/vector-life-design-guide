import type { Memory, MemoryCategory } from '../types';

/**
 * Phase 4 Week 4 (§2.1 of [`docs/memoir-memory-system.md`](
 * ../docs/memoir-memory-system.md)) — `services/memoryDecay.ts`
 *
 * Pure salience scorer for Memoir long-term memories. Each memory
 * carries an *implicit* salience that decays exponentially over
 * time unless re-affirmed (the user re-mentions the same fact in
 * a later round → dedup collapses the new candidate into the
 * matched memory and bumps `updatedAt` → score gets a
 * `reinforceBoost`).
 *
 * Why deterministic exponential decay (not e.g. learned ranker):
 *   - The whole memory bank fits in O(M ≤ 1000) per Memoir; a
 *     learned ranker would be massive overkill.
 *   - Pure + deterministic → trivially testable, no flaky CI.
 *   - Easy to *explain* to the user in the Memory management
 *     panel ("this memory will fade by half in N days").
 *
 * The function is intentionally side-effect free — the field
 * never lands in `Memory` itself, callers compute it on demand.
 * That keeps the persisted shape stable and the decay curve
 * tunable without a data migration.
 *
 * Used by:
 *   - `selectMemoriesForRecall` (§2.4) for ranking
 *   - `evictLowestSalience` (§2.3) for capacity-driven eviction
 *   - `MemoryManagementPanel` (§2.5) for the per-memory "fading"
 *     visual indicator
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Per-category base salience + half-life. See product-vision §B1
 *  + design doc §2.1 for the rationale behind each cell. */
export const DECAY_PARAMS: Record<MemoryCategory, { base: number; halfLifeDays: number }> = {
  milestone: { base: 1.0, halfLifeDays: 365 },
  relationship: { base: 0.8, halfLifeDays: 180 },
  emotion: { base: 0.7, halfLifeDays: 60 },
  fact: { base: 0.6, halfLifeDays: 90 },
};

/** Boost applied when the memory has been touched after creation
 *  (manual edit OR dedup-collapse). Small enough that a single
 *  reinforcement doesn't override the category curve, large
 *  enough that frequently re-mentioned facts visibly outrank
 *  drive-by ones. */
export const REINFORCE_BOOST = 0.15;

/**
 * Compute salience for a single memory. Returns a non-negative
 * number; consumers compare relatively (no absolute meaning).
 *
 * `now` is injected by the caller so all tests stay deterministic
 * and so a single recall round can score the entire bank against
 * the same instant.
 */
export const memorySalience = (memory: Memory, now: number): number => {
  // Soft-deleted memories should never contribute to salience-
  // driven decisions; callers should be filtering them out
  // upstream, but we belt-and-braces here so a future caller
  // that forgets won't accidentally surface a deleted memory.
  if (memory.deletedAt !== undefined) return 0;
  const params = DECAY_PARAMS[memory.category];
  if (!params) return 0;
  const ageMs = Math.max(0, now - memory.updatedAt);
  const ageDays = ageMs / MS_PER_DAY;
  // Standard exponential half-life decay: t = halfLife → multiplier
  // = 0.5; t = 2·halfLife → 0.25; etc.
  const decayed = params.base * Math.pow(0.5, ageDays / params.halfLifeDays);
  // Reinforcement only counts when the user (or dedup) has bumped
  // updatedAt past createdAt. We compare with a 1-second slop to
  // ignore the no-op equality of a freshly-minted memory.
  const reinforced = memory.updatedAt > memory.createdAt + 1000;
  return decayed + (reinforced ? REINFORCE_BOOST : 0);
};

/**
 * Predict the days remaining until salience drops to half its
 * **current** value. Used by the management panel to render a
 * human-friendly "this memory will fade by half in N days"
 * tooltip. Pure, no I/O.
 *
 * Returns Infinity for soft-deleted memories (they have salience 0
 * already) and for unknown categories (defensive — should never
 * happen at runtime).
 */
export const halfLifeRemaining = (memory: Memory, now: number): number => {
  const cur = memorySalience(memory, now);
  if (cur === 0) return Infinity;
  const params = DECAY_PARAMS[memory.category];
  if (!params) return Infinity;
  // For pure exponential decay the half-life is constant, so the
  // remaining-to-half-of-now is just one half-life. We surface
  // the per-category half-life directly — the reinforcement boost
  // doesn't decay (it's an additive constant) so this is exact.
  return params.halfLifeDays;
};

/**
 * Convenience: bucket the salience into a 4-level qualitative
 * label for UI rendering. Keeps the management panel from having
 * to know the absolute scoring ranges.
 */
export type SalienceTier = 'fresh' | 'warm' | 'cool' | 'fading';

export const salienceTier = (memory: Memory, now: number): SalienceTier => {
  const score = memorySalience(memory, now);
  if (score >= 0.65) return 'fresh';
  if (score >= 0.35) return 'warm';
  if (score >= 0.15) return 'cool';
  return 'fading';
};

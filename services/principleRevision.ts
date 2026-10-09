import type { Principle } from '../types';

/** The user, rather than the system, decides whether a new wording corrects history or records change. */
export type PrincipleRevisionKind = 'correction' | 'evolution';

export const isPrincipleRevisionKind = (value: unknown): value is PrincipleRevisionKind =>
  value === 'correction' || value === 'evolution';

const validRevision = (principle: Principle, all: Map<string, Principle>) =>
  Boolean(
    principle.supersedesPrincipleId &&
    all.has(principle.supersedesPrincipleId) &&
    isPrincipleRevisionKind(principle.revisionKind),
  );

/** Principles that should guide a present-tense response. */
export const currentPrinciples = (principles: Principle[]) => {
  const byId = new Map(principles.map((principle) => [principle.id, principle]));
  const superseded = new Set(
    principles
      .filter((principle) => validRevision(principle, byId))
      .map((principle) => principle.supersedesPrincipleId!),
  );
  return principles.filter((principle) => !superseded.has(principle.id));
};

/** A former principle remains useful only as explicitly marked historical context after an evolution. */
export const historicalEvolutionPrinciples = (principles: Principle[]) => {
  const byId = new Map(principles.map((principle) => [principle.id, principle]));
  return principles.flatMap((successor) => {
    if (!validRevision(successor, byId) || successor.revisionKind !== 'evolution') return [];
    const original = byId.get(successor.supersedesPrincipleId!);
    return original ? [{ principle: original, successor }] : [];
  });
};

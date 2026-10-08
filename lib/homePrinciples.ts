import type { Principle } from '../types';

export const getHomePrinciples = (principles: readonly Principle[]) =>
  principles
    .filter((principle) => principle.showOnHome)
    .map((principle) => ({ ...principle, sortDate: principle.createdAt }))
    .sort((a, b) => b.sortDate - a.sortDate);

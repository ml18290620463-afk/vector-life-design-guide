import type { DiaryEntry, PatternPrincipleLink, Principle } from '../types';
import { getDiaryStorageKeys } from './diaryStorage';
import { sanitizePrinciple } from './diaryDataRead';
import { applyPrincipleFeedback, applyPrincipleFeedbackToLinks } from './experienceFeedback';
import { vaultTransaction } from './vaultTransaction';

/** Principle feedback and its link validation are one commit, including after a retry. */
export async function commitPrincipleUpdate(
  updated: Principle,
  baseline: Principle[],
  fallbackLinks: PatternPrincipleLink[],
  userId?: string,
) {
  const keys = getDiaryStorageKeys(userId);
  return vaultTransaction([keys.principles, keys.patternPrincipleLinks, keys.entries], (values) => {
    const principles = ((values[keys.principles] as Principle[] | undefined) ?? baseline).map(
      sanitizePrinciple,
    );
    let links =
      (values[keys.patternPrincipleLinks] as PatternPrincipleLink[] | undefined) ?? fallbackLinks;
    const current = principles.find((item) => item.id === updated.id);
    if (!current) throw new Error('这条原则已被移除，请重新选择');
    const original = baseline.find((item) => item.id === updated.id);
    const newFeedbackIds = (updated.appliedFeedbackEntryIds ?? []).filter(
      (id) => !original?.appliedFeedbackEntryIds?.includes(id),
    );
    let next = updated;
    if (newFeedbackIds.length) {
      // Derive increments from committed results, never from an outdated UI counter.
      const entries = (values[keys.entries] as DiaryEntry[] | undefined) ?? [];
      next = current;
      for (const id of newFeedbackIds) {
        if (current.appliedFeedbackEntryIds?.includes(id)) continue;
        const feedback = entries
          .find((entry) => entry.id === id)
          ?.principleFeedback?.find((item) => item.principleId === updated.id);
        if (!feedback) throw new Error('未找到已保存的反馈记录，请重新读取后重试');
        next = applyPrincipleFeedback(next, feedback.outcome, feedback.createdAt, id);
        links = applyPrincipleFeedbackToLinks(
          links,
          updated.id,
          feedback.outcome,
          feedback.createdAt,
        );
      }
    } else {
      const same = (a: Principle | undefined, b: Principle | undefined) =>
        JSON.stringify(a && sanitizePrinciple(a)) === JSON.stringify(b && sanitizePrinciple(b));
      if (!same(current, original) && !same(current, updated))
        throw new Error('原则已在其他页面更新，请重新读取后重试');
      const outcome =
        (updated.helpfulCount ?? 0) > (current.helpfulCount ?? 0)
          ? 'helpful'
          : (updated.partialCount ?? 0) > (current.partialCount ?? 0)
            ? 'partial'
            : null;
      if (outcome)
        links = applyPrincipleFeedbackToLinks(links, updated.id, outcome, updated.lastFeedbackAt);
    }
    const saved = principles.map((item) => (item.id === updated.id ? next : item));
    values[keys.principles] = saved;
    values[keys.patternPrincipleLinks] = links;
    return { principles: saved, links };
  });
}

/**
 * Revisions keep the original record intact and add a successor in one vault
 * transaction, so a concurrent edit cannot silently rewrite history.
 */
export async function commitPrincipleRevision(
  original: Principle,
  successor: Principle,
  baseline: Principle[],
  fallbackLinks: PatternPrincipleLink[],
  userId?: string,
) {
  const keys = getDiaryStorageKeys(userId);
  return vaultTransaction([keys.principles, keys.patternPrincipleLinks], (values) => {
    const principles = ((values[keys.principles] as Principle[] | undefined) ?? baseline).map(
      sanitizePrinciple,
    );
    const current = principles.find((item) => item.id === original.id);
    if (!current) throw new Error('这条原则已被移除，请重新选择');
    if (JSON.stringify(sanitizePrinciple(current)) !== JSON.stringify(sanitizePrinciple(original)))
      throw new Error('原则已在其他页面更新，请重新读取后重试');
    if (principles.some((item) => item.id === successor.id))
      throw new Error('原则版本已存在，请重试');

    const savedSuccessor = sanitizePrinciple(successor);
    const links =
      (values[keys.patternPrincipleLinks] as PatternPrincipleLink[] | undefined) ?? fallbackLinks;
    const revisionLinks = links
      .filter((link) => link.principleId === original.id && link.status !== 'inactive')
      .map((link) => ({
        ...link,
        id: `${link.id}-revision-${savedSuccessor.id}`,
        principleId: savedSuccessor.id,
        createdAt: savedSuccessor.revisedAt ?? Date.now(),
        updatedAt: savedSuccessor.revisedAt ?? Date.now(),
      }));
    const saved = [savedSuccessor, ...principles];
    values[keys.principles] = saved;
    values[keys.patternPrincipleLinks] = [...revisionLinks, ...links];
    return { principles: saved, links: [...revisionLinks, ...links] };
  });
}

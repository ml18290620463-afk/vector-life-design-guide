import { beforeEach, describe, expect, it } from 'vitest';
import { englishHoldout } from './englishHoldout';
import { answerAvatarEvidence } from '../../services/avatarEvidenceDialogue';
import type { DiaryEntry, Principle } from '../../types';
import { cognition, evidenceGraph } from '../../tests/fixtures/avatarOntology';
const entry: DiaryEntry = {
  id: 'e',
  title: 'Preparation',
  content: 'I made a checklist but still missed a deadline.',
  tags: [],
  createdAt: 1,
  aiVisibility: 'allowed',
  isLocked: false,
};
const pattern = cognition({ statement: 'I prepare before acting.' });
const secondEntry = { ...entry, id: 'e2', createdAt: 86400001 };
const graph = evidenceGraph([pattern], [entry, secondEntry]);
const principle: Principle = {
  id: 'r',
  text: 'Check the deadline first.',
  year: 2026,
  createdAt: 1,
  showOnHome: true,
  aiVisibility: 'allowed',
  sourcePatternIds: ['p'],
};
beforeEach(() => localStorage.clear());
for (const group of ['en', 'mixed'] as const)
  describe(`independent ${group} holdout`, () => {
    for (const item of englishHoldout.filter((c) => c.group === group))
      it(item.id, () => {
        const answer = answerAvatarEvidence(
          item.question,
          graph,
          [principle],
          [entry, secondEntry],
          'en',
        );
        if (item.kind === 'narrative') {
          expect(answer).toBeNull();
          return;
        }
        expect(answer).toContain(entry.content);
        expect(answer).toContain('Unrecorded exceptions remain unknown');
        expect(answer).not.toMatch(/[\u4e00-\u9fff]/);
        if (item.kind !== 'principles') expect(answer).toContain(pattern.statement);
        if (item.kind !== 'patterns') {
          expect(answer).toContain(principle.text);
          expect(answer).toContain('No actual application feedback');
        }
        for (const denied of [
          { ...entry, aiVisibility: 'private' as const },
          { ...entry, isLocked: true },
          { ...entry, isEncrypted: true },
          { ...entry, isSample: true },
        ]) {
          const blocked = answerAvatarEvidence(item.question, graph, [principle], [denied], 'en');
          expect(blocked).not.toContain(entry.content);
          expect(blocked).not.toContain(pattern.statement);
          expect(blocked).not.toContain(principle.text);
        }
        expect(answerAvatarEvidence(item.question, graph, [principle], [], 'en')).not.toContain(
          entry.content,
        );
      });
  });

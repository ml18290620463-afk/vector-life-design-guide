import { beforeEach, expect, it, vi } from 'vitest';
import {
  atomicMemoryFromUnderstanding,
  readAvatarAtomicMemories,
  readAvatarUnderstandings,
  writeAvatarUnderstanding,
  writeAvatarAtomicMemory,
} from './avatarMemory';
import {
  archiveChanges,
  archiveScopeForMemory,
  isArchiveMemory,
  isDirectionCandidate,
  saveArchiveMemory,
} from './avatarMemoryArchive';
import { hasMeaningfulStatementChange } from './avatarMemoryShared';
import { buildGuidanceSources } from './avatarGuidance';
import * as storage from './browserStorage';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
const seed = () => {
  writeAvatarUnderstanding({
    id: 'other',
    statement: '保留的理解',
    status: 'confirmed',
    sourceEntryIds: [],
    createdAt: 1,
  });
  writeAvatarUnderstanding({
    id: 'pending',
    statement: '待确认的理解',
    status: 'pending',
    sourceEntryIds: ['entry-1'],
    createdAt: 2,
  });
  return atomicMemoryFromUnderstanding(readAvatarUnderstandings().find((p) => p.id === 'pending')!);
};
it('confirms and edits the canonical understanding without a second copy or superseding others', () => {
  const memory = seed();
  expect(saveArchiveMemory(memory, '修正后的理解', 'confirmed')).toBe(true);
  expect(readAvatarAtomicMemories()).toEqual([]);
  expect(readAvatarUnderstandings()).toHaveLength(2);
  expect(readAvatarUnderstandings().find((p) => p.id === 'pending')).toMatchObject({
    statement: '修正后的理解',
    status: 'confirmed',
    sourceEntryIds: ['entry-1'],
  });
  expect(readAvatarUnderstandings().find((p) => p.id === 'other')?.status).toBe('confirmed');
  expect(saveArchiveMemory(memory, '修正后的理解', 'rejected')).toBe(true);
  expect(
    buildGuidanceSources({
      entries: [],
      principles: [],
      actions: [],
      patterns: readAvatarUnderstandings(),
    }).map((s) => s.text),
  ).not.toContain('修正后的理解');
});
it('rejects edits to canonical events and reports storage failure', () => {
  const memory = seed();
  expect(isArchiveMemory({ ...memory, id: 'avatar_entry_source' })).toBe(false);
  expect(saveArchiveMemory({ ...memory, id: 'avatar_entry_source' }, '不应写入', 'confirmed')).toBe(
    false,
  );
  vi.spyOn(storage, 'setStoredJson').mockReturnValue(false);
  expect(saveArchiveMemory(memory, '不能保存', 'confirmed')).toBe(false);
  expect(readAvatarUnderstandings().find((p) => p.id === 'pending')?.status).toBe('pending');
});

it('keeps canonical past and future projections out of the archive while allowing proposed directions', () => {
  expect(isArchiveMemory({ ...seed(), id: 'atomic_pattern_1' })).toBe(false);
  expect(isDirectionCandidate({ nature: 'commitment', facets: ['boundary'] })).toBe(true);
  expect(isDirectionCandidate({ nature: 'explicit', facets: ['preference'] })).toBe(false);
});

it('compares reviewed pattern versions and hides the comparison after forgetting', () => {
  const memory = seed();
  saveArchiveMemory(memory, '过去我习惯独自完成', 'confirmed');
  saveArchiveMemory(memory, '现在我会先判断是否需要协作', 'confirmed');
  const changes = archiveChanges([], readAvatarUnderstandings());
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({
    before: '过去我习惯独自完成',
    after: '现在我会先判断是否需要协作',
  });
  saveArchiveMemory(memory, '现在我会先判断是否需要协作', 'rejected');
  expect(archiveChanges([], readAvatarUnderstandings())).toEqual([]);
});

it('classifies identity before evidence and only compares explicitly linked reviewed memories', () => {
  const base = {
    ...seed(),
    id: 'personal',
    facets: ['preference' as const],
    confirmedAt: 1,
    status: 'confirmed' as const,
  };
  expect(archiveScopeForMemory(base)).toBe('self');
  expect(archiveScopeForMemory({ ...base, id: 'avatar_principle_1' })).toBeNull();
  expect(archiveScopeForMemory({ ...base, facets: ['behavioral_pattern'] })).toBe('pattern');
  writeAvatarAtomicMemory({ ...base, statement: '喜欢独处' });
  writeAvatarAtomicMemory({ ...base, statement: '喜欢小范围交流', updatedAt: 2 });
  expect(archiveChanges(readAvatarAtomicMemories(), [])).toHaveLength(1);
  expect(archiveChanges([{ ...base, statement: '孤立的编辑记录' }], [])).toEqual([]);
});

it('keeps formatting-only edits out of my changes', () => {
  expect(hasMeaningfulStatementChange('我会先留出空间，再做决定。', '我会先留出空间，再做决定')).toBe(false);
  expect(hasMeaningfulStatementChange('我会先留出空间，再做决定。', '我会先确认边界，再做决定。')).toBe(true);

  const before = {
    id: 'before',
    statement: '我会先留出空间，再做决定。',
    nature: 'explicit' as const,
    facets: ['value' as const],
    tags: [], contexts: [], sourceRefs: [], confidence: 1,
    status: 'superseded' as const, sensitivity: 'normal' as const,
    createdAt: 1, confirmedAt: 1,
  };
  const after = {
    ...before,
    id: 'after',
    previousVersionId: 'before',
    statement: '我会先留出空间，再做决定',
    status: 'confirmed' as const,
    createdAt: 2,
  };
  expect(archiveChanges([before, after], [])).toEqual([]);
});

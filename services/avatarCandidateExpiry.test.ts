import { afterEach, expect, it, vi } from 'vitest';
import {
  CANDIDATE_MEMORY_TTL,
  readAvatarAtomicMemories,
  writeAvatarAtomicMemory,
  updateAvatarAtomicMemoryStatus,
} from './avatarMemoryAtoms';
import type { AvatarAtomicMemory } from '../features/avatar/types';
import {
  readAvatarUnderstandings,
  writeAvatarUnderstanding,
  updateAvatarUnderstandingStatus,
} from './avatarMemoryUnderstandings';

const candidate: AvatarAtomicMemory = {
  id: 'expiry',
  statement: '提前准备让我轻松',
  nature: 'explicit',
  facets: ['preference'],
  tags: [],
  contexts: [],
  sourceRefs: [{ source: 'entry', id: 'original', excerpt: '提前准备让我轻松' }],
  confidence: 0.8,
  status: 'candidate',
  sensitivity: 'normal',
  createdAt: 1,
};
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});
it('also deletes pending understandings without deleting confirmed understandings', () => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  writeAvatarUnderstanding({
    id: 'pending',
    statement: '待确认',
    status: 'pending',
    sourceEntryIds: ['original'],
    createdAt: Date.now(),
  });
  writeAvatarUnderstanding({
    id: 'confirmed',
    statement: '已确认',
    status: 'confirmed',
    sourceEntryIds: ['original'],
    createdAt: Date.now(),
  });
  vi.advanceTimersByTime(CANDIDATE_MEMORY_TTL);
  expect(readAvatarUnderstandings().map((item) => item.id)).toEqual(['confirmed']);
  expect(updateAvatarUnderstandingStatus('pending', 'confirmed')).toBeNull();
  expect(JSON.parse(localStorage.getItem('vector:avatar:understandings:v1')!)).toHaveLength(1);
});
it('expires candidates exactly 24 hours after generation and physically removes them', () => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  expect(writeAvatarAtomicMemory(candidate)).toBe(true);
  vi.setSystemTime(100000 + CANDIDATE_MEMORY_TTL - 1);
  expect(readAvatarAtomicMemories()).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(readAvatarAtomicMemories()).toEqual([]);
  expect(JSON.parse(localStorage.getItem('vector:avatar:atomic-memories:v1')!)).toEqual([]);
  expect(updateAvatarAtomicMemoryStatus('expiry', 'confirmed')).toBeNull();
});
it('retains confirmed memories and their source evidence after the candidate deadline', () => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  writeAvatarAtomicMemory(candidate);
  updateAvatarAtomicMemoryStatus('expiry', 'confirmed');
  vi.advanceTimersByTime(CANDIDATE_MEMORY_TTL);
  expect(readAvatarAtomicMemories()[0]).toMatchObject({
    status: 'confirmed',
    sourceRefs: candidate.sourceRefs,
  });
});
it('does not silently add unreviewed facets to an already confirmed statement', () => {
  writeAvatarAtomicMemory({ ...candidate, status: 'confirmed' });
  writeAvatarAtomicMemory({
    ...candidate,
    id: 'new-inference',
    facets: ['preference', 'boundary'],
    contexts: ['新推断'],
  });
  expect(readAvatarAtomicMemories()[0]).toMatchObject({
    status: 'confirmed',
    facets: ['preference'],
    contexts: [],
  });
});

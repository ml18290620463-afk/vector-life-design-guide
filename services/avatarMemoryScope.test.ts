import { beforeEach, describe, expect, it } from 'vitest';
import type { AvatarAtomicMemory } from '../features/avatar/types';
import {
  readAvatarAtomicMemories,
  writeAvatarAtomicMemory,
  supersedeAvatarAtomicMemory,
  updateAvatarAtomicMemoryStatus,
} from './avatarMemoryAtoms';

const memory = (patch: Partial<AvatarAtomicMemory> = {}): AvatarAtomicMemory => ({
  id: 'old',
  statement: '我喜欢安静',
  nature: 'explicit',
  facets: ['preference'],
  tags: [],
  contexts: [],
  sourceRefs: [{ source: 'message', id: 'original' }],
  confidence: 0.7,
  status: 'confirmed',
  sensitivity: 'normal',
  createdAt: 1,
  ...patch,
});

beforeEach(() => localStorage.clear());
describe('memory scope and revisions', () => {
  it('keeps the same wording in different contexts separate', () => {
    writeAvatarAtomicMemory(memory({ contexts: ['工作'] }));
    writeAvatarAtomicMemory(memory({ id: 'new', contexts: ['社交'], status: 'candidate' }));
    expect(readAvatarAtomicMemories()).toHaveLength(2);
  });
  it('does not turn an inference into an explicit confirmed fact', () => {
    writeAvatarAtomicMemory(memory());
    writeAvatarAtomicMemory(memory({ id: 'new', nature: 'inferred', status: 'candidate' }));
    expect(readAvatarAtomicMemories()).toHaveLength(2);
  });
  it('preserves separate occurrences of a temporary feeling', () => {
    writeAvatarAtomicMemory(memory({ nature: 'state', statement: '我很累' }));
    writeAvatarAtomicMemory(
      memory({ id: 'later', nature: 'state', statement: '我很累', createdAt: 2 }),
    );
    expect(readAvatarAtomicMemories()).toHaveLength(2);
  });
  it('does not suppress new evidence solely because a topic was rejected', () => {
    writeAvatarAtomicMemory(
      memory({ nature: 'inferred', patternKey: '独处', facets: ['cognitive_pattern'] }),
    );
    updateAvatarAtomicMemoryStatus('old', 'rejected');
    writeAvatarAtomicMemory(
      memory({
        id: 'new',
        nature: 'inferred',
        statement: '我在冲突后可能需要独处',
        patternKey: '独处',
        facets: ['cognitive_pattern'],
        status: 'candidate',
        sourceRefs: [{ source: 'message', id: 'different' }],
      }),
    );
    expect(readAvatarAtomicMemories()).toHaveLength(2);
  });
  it('keeps a conflicting candidate inactive and uses new evidence only after explicit replacement', () => {
    writeAvatarAtomicMemory(memory());
    writeAvatarAtomicMemory(
      memory({ id: 'candidate', statement: '我喜欢热闹', status: 'candidate' }),
    );
    expect(readAvatarAtomicMemories().find((item) => item.id === 'old')?.status).toBe('confirmed');
    const next = supersedeAvatarAtomicMemory('old', '我喜欢热闹', {
      sourceRefs: [{ source: 'message', id: 'new-source' }],
      nature: 'explicit',
      facets: ['preference'],
      contexts: [],
      tags: [],
    });
    expect(next?.sourceRefs).toEqual([{ source: 'message', id: 'new-source' }]);
    expect(next?.previousVersionId).toBe('old');
    expect(readAvatarAtomicMemories().find((item) => item.id === 'old')).toMatchObject({
      status: 'superseded',
      sourceRefs: [{ source: 'message', id: 'original' }],
    });
  });
});

import type { AvatarAtomicMemory } from '../../avatar/types';
import type { AvatarMemoryExtractionReference } from '../api/avatar';

export const buildAvatarMemoryReferences = (
  memories: AvatarAtomicMemory[],
): AvatarMemoryExtractionReference[] =>
  memories.flatMap((memory) => {
    if (
      memory.status !== 'candidate' &&
      memory.status !== 'confirmed' &&
      memory.status !== 'retained'
    )
      return [];
    return [
      {
        id: memory.id,
        text: memory.statement,
        status: memory.status,
        ...(memory.patternKey ? { patternKey: memory.patternKey } : {}),
        ...(memory.category ? { category: memory.category } : {}),
      },
    ];
  });

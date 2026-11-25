import type { CognitiveObject } from '../../avatar/types';
import type { AvatarMemoryExtractionReference } from '../api/avatar';

export const buildAvatarMemoryReferences = (
  memories: CognitiveObject[],
): AvatarMemoryExtractionReference[] =>
  memories.flatMap((memory) => {
    if (
      memory.status !== 'candidate' &&
      memory.status !== 'confirmed' &&
      memory.status !== 'retained_after_source_delete'
    )
      return [];
    return [
      {
        id: memory.id,
        text: memory.statement,
        status: memory.status === 'retained_after_source_delete' ? 'retained' : memory.status,
      },
    ];
  });

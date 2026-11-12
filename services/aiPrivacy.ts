import { readAvatarAtomicMemories } from './avatarMemoryAtoms';
import { readAvatarUnderstandings } from './avatarMemoryUnderstandings';
import type { Principle } from '../types';
import type { AvatarAtomicMemory } from '../features/avatar/types';
import { getMany } from './accountIdb';
import type { FutureState } from '../types/future';
import type { ActionItem } from '../types';
import type { DiaryEntry } from '../types';
import type { ChatMessage } from '../features/now/types/now';
import { DiaryStorageKeys } from './diaryStorage';

export type AIVisibility = 'private' | 'allowed';
export const canAIReadEntry = (entry: DiaryEntry, now = Date.now()) =>
  entry.aiVisibility === 'allowed' &&
  !entry.isSample &&
  !entry.isLocked &&
  !entry.isEncrypted &&
  (!entry.unlockAt || entry.unlockAt <= now);

// Conservative context boundary: changes to record permissions invalidate prior
// conversation context. Keep the transcript locally, never silently re-authorize it.
export const aiPrivacyToken = (
  entries: DiaryEntry[],
  future?: FutureState,
  actions: ActionItem[] = [],
  principles: Principle[] = [],
  memories: AvatarAtomicMemory[] = readAvatarAtomicMemories(),
) =>
  JSON.stringify([
    'ai-consent-v3',
    principles.map(p => [p.id, p.aiVisibility === 'allowed', p.aiConsentAt ?? 0]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))),
    memories.map(m => [m.id, m.aiVisibility === 'allowed', m.aiConsentAt ?? 0, m.status]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))),
    readAvatarUnderstandings().map(p => [p.id, p.aiVisibility === 'allowed', p.aiConsentAt ?? 0, p.status]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))),
    future?.revision ?? 0,
    [...(future?.visions ?? []), ...(future?.goals ?? []), ...actions]
      .map((v) => [v.id, v.aiVisibility === 'allowed', v.aiConsentAt ?? 0, v.updatedAt ?? 0])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    entries
      .filter((e) => !e.isSample)
      .map((e) => [e.id, canAIReadEntry(e), e.aiConsentAt ?? 0, e.aiSourceSessionId ?? ''])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ]);
export const isAIMessageAllowed = (
  message: ChatMessage,
  entries: DiaryEntry[],
  token = aiPrivacyToken(entries),
) =>
  message.aiPrivacyToken === token &&
  !(message.references ?? []).some(
    (ref) => !entries.some((e) => e.id === ref.entryId && canAIReadEntry(e)),
  );
export async function readAIPrivacy() {
  const [storedEntries, future, storedActions, storedPrinciples] = await getMany([
    DiaryStorageKeys.entries,
    DiaryStorageKeys.future,
    DiaryStorageKeys.actions,
    DiaryStorageKeys.principles,
  ]);
  const entries = (storedEntries ?? []) as DiaryEntry[];
  const actions = (storedActions ?? []) as ActionItem[];
  return { entries, token: aiPrivacyToken(entries, future as FutureState | undefined, actions, (storedPrinciples ?? []) as Principle[]) };
}
export async function assertAIPrivacyUnchanged(token: string) {
  if ((await readAIPrivacy()).token !== token)
    throw new Error('记录的 AI 权限已变化，请重新发起请求');
}

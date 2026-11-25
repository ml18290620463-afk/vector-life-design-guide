import { selectAvatarOntologyContext } from './avatarOntologyContext';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { Principle } from '../types';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { avatarOntologyTransaction, readFreshAvatarSnapshot } from './avatarOntologyTransaction';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { VaultConflictError } from './vaultTransaction';
import { withAvatarSession } from './avatarOntologySessionGuard';
import type { FutureState } from '../types/future';
import type { ActionItem } from '../types';
import type { DiaryEntry } from '../types';
import type { ChatMessage } from '../features/now/types/now';
import { DiaryStorageKeys } from './diaryStorage';

export type AIVisibility = 'private' | 'allowed';
export { canAIReadEntry } from './aiEntryAccess';
import { canAIReadEntry } from './aiEntryAccess';

// Conservative context boundary: changes to record permissions invalidate prior
// conversation context. Keep the transcript locally, never silently re-authorize it.
export const aiPrivacyToken = (
  entries: DiaryEntry[],
  future?: FutureState,
  actions: ActionItem[] = [],
  principles: Principle[] = [],
  graph: AvatarOntologySnapshot = { ontologySchemaVersion: 2, revision: 0, objects: [], edges: [] },
) => ontologyPrivacyToken(graph, entries, future, actions, principles);
export const isAIMessageAllowed = (
  message: ChatMessage,
  entries: DiaryEntry[],
  token = aiPrivacyToken(entries),
) =>
  isPrivacyContextCompatible(message.aiPrivacyToken, token) &&
  !(message.references ?? []).some(
    (ref) => !entries.some((e) => e.id === ref.entryId && canAIReadEntry(e)),
  );
export async function readAIPrivacy() {
  // Read/decrypt all permissions in one guarded snapshot. In particular Future and
  // actions may be encrypted envelopes, never plain objects from accountIdb.
  // This read must not initialize/migrate Avatar: NOW/Past/Future remain usable
  // while a legacy Avatar is waiting for password setup.
  let initialToken: string | undefined;
  return withAvatarSession((assertCurrent) =>
    readFreshAvatarSnapshot(
      () =>
        avatarOntologyTransaction(
          [
            AVATAR_ONTOLOGY_KEY,
            DiaryStorageKeys.entries,
            DiaryStorageKeys.future,
            DiaryStorageKeys.actions,
            DiaryStorageKeys.principles,
          ],
          (values) => {
            assertCurrent();
            const entries = (values[DiaryStorageKeys.entries] ?? []) as DiaryEntry[];
            const graph = values[AVATAR_ONTOLOGY_KEY] as AvatarOntologySnapshot | undefined;
            const token = aiPrivacyToken(
              entries,
              values[DiaryStorageKeys.future] as FutureState | undefined,
              (values[DiaryStorageKeys.actions] ?? []) as ActionItem[],
              (values[DiaryStorageKeys.principles] ?? []) as Principle[],
              values[AVATAR_ONTOLOGY_KEY] as AvatarOntologySnapshot | undefined,
            );
            // Session autosaves may invalidate the graph bytes without changing consent.
            // A permission change must fail closed, even when a fresh read is available.
            if (initialToken !== undefined && initialToken !== token)
              throw new VaultConflictError();
            initialToken = token;
            return {
              entries,
              token,
              cognitiveContext: graph ? selectAvatarOntologyContext(graph, entries, token) : [],
            };
          },
          true,
          undefined,
          assertCurrent,
        ),
      assertCurrent,
    ),
  );
}
export async function assertAIPrivacyUnchanged(token: string) {
  if ((await readAIPrivacy()).token !== token)
    throw new Error('记录的 AI 权限已变化，请重新发起请求');
}

/** Keep prior authorized sources as conservative dependencies; additions and private-only
 * edits cannot have influenced an earlier reply. Legacy/malformed tokens fail closed.
 * Future revision remains strict until all derived-source dependencies are tracked. */
export function isPrivacyContextCompatible(previous: string | undefined, current: string): boolean {
  if (!previous) return false;
  if (previous === current) return true;
  try {
    const before = JSON.parse(previous);
    const after = JSON.parse(current);
    if (
      !Array.isArray(before) ||
      !Array.isArray(after) ||
      before.length !== 7 ||
      after.length !== 7 ||
      !['ai-consent-v3', 'ai-consent-v4', 'ai-consent-v5'].includes(before[0]) ||
      after[0] !== before[0] ||
      before[4] !== after[4]
    )
      return false;
    return [1, 2, 3, 5, 6].every((index) => {
      if (!Array.isArray(before[index]) || !Array.isArray(after[index])) return false;
      return before[index].every((row: unknown) => {
        if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'boolean')
          return false;
        if (!row[1]) return true;
        return after[index].some((next: unknown) => JSON.stringify(next) === JSON.stringify(row));
      });
    });
  } catch {
    return false;
  }
}

/** Pure v2 token builder: never reads or prunes legacy stores. */
export function ontologyPrivacyToken(
  graph: AvatarOntologySnapshot,
  entries: DiaryEntry[],
  future?: FutureState,
  actions: ActionItem[] = [],
  principles: Principle[] = [],
): string {
  const ordered = (rows: unknown[][]) =>
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify([
    'ai-consent-v5',
    ordered(principles.map((p) => [p.id, p.aiVisibility === 'allowed', p.aiConsentAt ?? 0])),
    ordered(
      graph.objects.map((o) => [
        o.id,
        o.privacy.aiVisible && o.status === 'confirmed',
        o.updatedAt,
        o.status,
        // Fingerprint source-dependent content without carrying private text in context.
        bytesToHex(
          sha256(
            new TextEncoder().encode(
              JSON.stringify([
                o.statement,
                o.validity,
                o.privacy,
                graph.edges.filter((e) => e.fromId === o.id),
              ]),
            ),
          ),
        ),
      ]),
    ),
    [],
    future?.revision ?? 0,
    ordered(
      [...(future?.visions ?? []), ...(future?.goals ?? []), ...actions].map((v) => [
        v.id,
        v.aiVisibility === 'allowed',
        v.aiConsentAt ?? 0,
        v.updatedAt ?? 0,
      ]),
    ),
    ordered(
      entries
        .filter((e) => !e.isSample)
        .map((e) => [
          e.id, canAIReadEntry(e), e.aiConsentAt ?? 0, e.aiSourceSessionId ?? '',
          // A permitted source can be edited without changing its consent fields.
          // Bind in-flight requests to the exact authoritative source bytes too.
          bytesToHex(sha256(new TextEncoder().encode(JSON.stringify([
            e.title, e.content, e.tags, e.createdAt, e.updatedAt,
          ])))),
        ]),
    ),
  ]);
}

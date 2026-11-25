import type { AvatarLaunchContext, AvatarSession } from '../features/avatar/types';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { persistAvatarOntologySession, readAvatarOntology } from './avatarOntologyStore';
import { withAvatarSession } from './avatarOntologySessionGuard';

/** Keep the original message order and indices; never merge separate evidence sources. */
export function selectAvatarConversation(
  graph: AvatarOntologySnapshot,
  context: AvatarLaunchContext,
): AvatarSession | null {
  if (context.mode !== 'general') return null;
  const session = (graph.sessions ?? [])
    .filter(
      (item) =>
        item.mode === context.mode &&
        item.context.source === context.source &&
        item.context.entryId === context.entryId &&
        item.context.actionId === context.actionId &&
        item.messages.some((message) => message.type === 'text'),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return session ? structuredClone(session) : null;
}

/** A page-owned queue orders autosave and extraction. A failed save remains visible to callers. */
export function createAvatarSessionWriter() {
  let tail: Promise<unknown> = Promise.resolve();
  return (session: AvatarSession): Promise<AvatarOntologySnapshot> => {
    const incoming = structuredClone(session);
    const previous = tail;
    // Capture the permission generation when enqueued, not after earlier writes finish.
    const operation = withAvatarSession(async (assertCurrent) => {
      await previous.catch(() => undefined);
      assertCurrent();
      const graph = await readAvatarOntology();
      assertCurrent();
      return persistAvatarOntologySession(graph.revision, incoming);
    });
    tail = operation;
    return operation;
  };
}

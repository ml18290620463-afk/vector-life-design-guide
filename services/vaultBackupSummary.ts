import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import {
  summarizeMaterialReferences,
  type MaterialReferenceSummary,
} from '../lib/materialPersistence';
import type { DiaryEntry } from '../types';
import type { FutureState } from '../types/future';

export interface VaultBackupContentSummary {
  entries: number;
  supplements: number;
  /** All material references found in the backup. */
  materials: number;
  portableMaterials: number;
  hasDraft: boolean;
  visions: number;
  goals: number;
  actions: number;
  confirmedMemories: number;
  conversations: number;
  materialReferences: MaterialReferenceSummary;
}

type BackupLike = {
  entries: DiaryEntry[];
  vault: {
    data: { materials: unknown[]; actions: unknown[] };
    future: FutureState;
    draft?: unknown | null;
    futureDrafts?: Record<string, unknown>;
    ontology?: AvatarOntologySnapshot;
    caches: Record<string, unknown[]>;
  };
};

const hasDraftContent = (draft: unknown) => {
  if (!draft || typeof draft !== 'object') return false;
  const value = draft as {
    text?: unknown;
    materials?: unknown[];
    mood_tags?: unknown[];
    event_tags?: unknown[];
  };
  return Boolean(
    (typeof value.text === 'string' && value.text.trim()) ||
    value.materials?.length ||
    value.mood_tags?.length ||
    value.event_tags?.length,
  );
};

export const materialReferencesForBackup = (backup: BackupLike): MaterialReferenceSummary => {
  const references: Array<string | null | undefined> = [];
  for (const entry of backup.entries) {
    if (entry.attachment) references.push(entry.attachment.data);
    for (const material of entry.nowMaterials ?? []) references.push(material.url);
  }
  const draft = backup.vault.draft as { materials?: Array<{ url?: string }> } | null | undefined;
  for (const material of draft?.materials ?? []) references.push(material.url);
  for (const row of backup.vault.data.materials) {
    if (!row || typeof row !== 'object') continue;
    const candidate = row as { data?: unknown; url?: unknown };
    references.push(
      typeof candidate.data === 'string'
        ? candidate.data
        : typeof candidate.url === 'string'
          ? candidate.url
          : undefined,
    );
  }
  return summarizeMaterialReferences(references);
};

/** A user-facing inventory. Candidate memories deliberately do not count as retained understanding. */
export const summarizeVaultBackupContent = (backup: BackupLike): VaultBackupContentSummary => {
  const materialReferences = materialReferencesForBackup(backup);
  const confirmedMemories = (backup.vault.ontology?.objects ?? []).filter(
    (object) => object.status === 'confirmed' || object.status === 'retained_after_source_delete',
  ).length;
  return {
    entries: backup.entries.length,
    supplements: backup.entries.reduce(
      (total, entry) => total + (entry.supplements?.length ?? 0),
      0,
    ),
    materials:
      materialReferences.embedded +
      materialReferences.externalLink +
      materialReferences.unstableReference,
    portableMaterials: materialReferences.embedded,
    hasDraft:
      hasDraftContent(backup.vault.draft) ||
      Object.keys(backup.vault.futureDrafts ?? {}).length > 0,
    visions: backup.vault.future.visions.length,
    goals: backup.vault.future.goals.length,
    // FutureState.items are goal checklist items. Deliberate actions live in the
    // separate vault domain and are what users see in the action plan.
    actions: backup.vault.data.actions.length,
    confirmedMemories,
    conversations: (backup.vault.ontology?.sessions ?? []).length,
    materialReferences,
  };
};

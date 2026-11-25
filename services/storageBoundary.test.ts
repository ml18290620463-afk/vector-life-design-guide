import { beforeEach, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { clear, get } from 'idb-keyval';
import { useDiaryData } from '../hooks/useDiaryData';
import { useAppStore } from '../stores/appStore';
import { getDiaryStorageKeys } from './diaryStorage';
import { AVATAR_V1_KEYS } from './avatarOntologyMigration';
import { decodeAvatarMigrationCheckpoint } from './avatarOntologyMigrationCheckpoint';
import {
  markPastRecordProcessed,
  pastRecordFingerprint,
  PAST_PROCESSING_KEY,
} from './pastProcessingCache';
import { saveNowDraft, loadNowDraft } from './nowDraftRepository';
import { PRIVATE_DRAFT_KEY } from './privateDraftKey';
import { createEmptyDraft } from '../features/now/state/nowRules';
import { changeFutureProtection } from './vaultTransaction';
import { SecurityService } from './securityService';
import { exportVaultBackupFile, validateVaultBackup } from './vaultBackup';
import { decryptVaultBackupFile, isEncryptedVaultBackup } from './vaultBackupFile';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ isUnlocked: true, masterPassword: null, userId: 'local-user' });
});
it('measures real writes: selective local protection and whole backup encryption', async () => {
  const markers = {
    entry: 'MARKER_RECORD_764',
    material: 'MARKER_MATERIAL_918',
    memory: 'MARKER_MEMORY_582',
    draft: 'MARKER_DRAFT_236',
  };
  const { result, unmount } = renderHook(() => useDiaryData('local-user'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.addEntry({
      title: 'boundary',
      content: markers.entry,
      tags: [],
      aiVisibility: 'private',
    });
  });
  await act(async () => {
    await result.current.addMaterial({
      type: 'other',
      data: 'data:text/plain;base64,eA==',
      name: markers.material,
      mimeType: 'text/plain',
    });
  });
  localStorage.setItem(
    AVATAR_V1_KEYS.atoms,
    JSON.stringify([
      {
        id: 'boundary-memory',
        statement: markers.memory,
        nature: 'explicit',
        facets: ['preference'],
        contexts: [],
        tags: [],
        sourceRefs: [],
        confidence: 1,
        status: 'confirmed',
        sensitivity: 'normal',
        createdAt: 1,
        aiVisibility: 'private',
      },
    ]),
  );
  await saveNowDraft({ ...createEmptyDraft(), text: markers.draft }, 0);
  const entry = result.current.entries[0];
  markPastRecordProcessed(entry.id, pastRecordFingerprint(entry));
  const keys = getDiaryStorageKeys('local-user');
  expect(JSON.stringify(await get(keys.entries))).toContain(markers.entry);
  expect(JSON.stringify(await get(keys.materials))).toContain(markers.material);
  expect(localStorage.getItem('vector:avatar:atomic-memories:v1')).toContain(markers.memory);
  expect(JSON.stringify(await get(PRIVATE_DRAFT_KEY))).toContain(markers.draft);
  expect(localStorage.getItem(PAST_PROCESSING_KEY)).toContain(pastRecordFingerprint(entry));
  expect(localStorage.getItem(PAST_PROCESSING_KEY)).not.toContain(markers.entry);
  // Legacy cognition cannot be exported without its encrypted recovery checkpoint.
  await expect(exportVaultBackupFile('boundary', 'local-user')).rejects.toThrow();
  expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toContain(markers.memory);
  const password = 'Boundary-private-123!';
  const salt = 'boundary-test-salt';
  await act(async () => {
    await changeFutureProtection(
      password,
      await SecurityService.hashPassword(password, salt),
      salt,
    );
    useAppStore.setState({ masterPassword: password });
  });
  // A master lock does not silently upgrade ordinary records/materials/memory.
  expect(JSON.stringify(await get(keys.entries))).toContain(markers.entry);
  expect(JSON.stringify(await get(keys.materials))).toContain(markers.material);
  expect(localStorage.getItem('vector:avatar:atomic-memories:v1')).toContain(markers.memory);
  expect(JSON.stringify(await get(PRIVATE_DRAFT_KEY))).not.toContain(markers.draft);
  expect((await loadNowDraft()).draft?.text).toBe(markers.draft);
  const encrypted = await exportVaultBackupFile('boundary', 'local-user');
  expect(isEncryptedVaultBackup(encrypted)).toBe(true);
  if (!isEncryptedVaultBackup(encrypted)) throw new Error('Expected encrypted envelope');
  for (const marker of Object.values(markers))
    expect(JSON.stringify(encrypted)).not.toContain(marker);
  const decrypted = await decryptVaultBackupFile(encrypted, password);
  for (const marker of [markers.entry, markers.material, markers.draft])
    expect(JSON.stringify(decrypted)).toContain(marker);
  validateVaultBackup(decrypted);
  expect(decrypted.vault.ontology?.ontologySchemaVersion).toBe(2);
  expect(decrypted.vault.caches).not.toHaveProperty(AVATAR_V1_KEYS.atoms);
  const checkpoint = decrypted.vault.migrationCheckpoint!;
  expect(JSON.stringify(checkpoint)).not.toContain(markers.memory);
  const decoded = await decodeAvatarMigrationCheckpoint(checkpoint, password);
  expect(decoded.snapshot.raw.atoms).toContain(markers.memory);
  await expect(decryptVaultBackupFile(encrypted, 'incorrect')).rejects.toThrow();
  unmount();
});

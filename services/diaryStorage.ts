import {
  getStoredJson,
  getStoredString,
  removeStoredValue,
  setStoredString,
} from './browserStorage';

const MIRROR_SKIP_LIMIT = 100000;

/**
 * Hard upper bound for any single attachment, expressed in bytes of the
 * original file. base64 encoding inflates by ~33% so the real footprint in
 * IndexedDB / localStorage will be larger than this.
 */
export const ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;

/**
 * Soft warning threshold; attachments above this size are still allowed but
 * the UI should remind the user they may impact persistence and backups.
 */
export const ATTACHMENT_WARN_BYTES = 5 * 1024 * 1024;

export type AttachmentSizeVerdict = 'ok' | 'warn' | 'reject';

export interface AttachmentSizeAssessment {
  verdict: AttachmentSizeVerdict;
  bytes: number;
}

/**
 * Classify a candidate attachment by its raw byte size, independent of the
 * eventual base64 encoding. Used by Dashboard upload flow to pick between
 * silently accepting, prompting the user, or hard-rejecting.
 */
export const evaluateAttachmentSize = (bytes: number): AttachmentSizeAssessment => {
  const safeBytes = Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : 0;
  if (safeBytes > ATTACHMENT_MAX_BYTES) {
    return { verdict: 'reject', bytes: safeBytes };
  }
  if (safeBytes >= ATTACHMENT_WARN_BYTES) {
    return { verdict: 'warn', bytes: safeBytes };
  }
  return { verdict: 'ok', bytes: safeBytes };
};

/**
 * Returns true when the entries snapshot is too large to safely mirror to
 * localStorage. Callers can use this to drop a syncStatus warning rather than
 * pretending the mirror succeeded silently.
 */
export const entriesPayloadExceedsMirror = (serializedLength: number): boolean =>
  serializedLength > MIRROR_SKIP_LIMIT;

export const DiaryStorageKeys = {
  entries: 'vector_master_vault_entries',
  principles: 'vector_master_vault_principles',
  passwordHash: 'vector_master_vault_pwd_hash',
  passwordSalt: 'vector_master_vault_pwd_salt',
  guidingStars: 'vector_master_vault_stars',
  containers: 'vector_master_vault_containers',
  /**
   * Phase 4 §4.b-3 — per-device Ed25519 keypair for backup signing.
   * Stored as a JSON `{ publicKey, encryptedSecret, createdAt }`.
   * `publicKey` is the 32-byte raw Ed25519 public key, base64-encoded
   * (64-char without padding); `encryptedSecret` is the 32-byte raw
   * secret key encrypted with AES-GCM under a key derived from the
   * master password (so a stolen IndexedDB blob is useless without
   * the password). The keypair is generated once on `handleSetPassword`
   * and re-generated only when the user explicitly clicks
   * "Regenerate device keys" in Settings.
   */
  deviceKeypair: 'vector_master_vault_device_keypair',
  /**
   * Phase 5 §5.1 — license token + matching install id. Stored as
   * `{ token: string, installId: string, activatedAt: number }`.
   * The token is opaque to IDB inspection; verification happens
   * inside `licenseStore.loadLicense` against `LICENSE_KEYRING`.
   * Wiped on `wipeData` so an "I'm done with this device" reset
   * also drops the license (the user can re-paste it on the next
   * device — the license is bound to `installId`, not to a
   * physical device).
   */
  license: 'vector_master_vault_license',
  backup: 'vector_backup_unified',
  initializedFlag: 'vector_vault_v1_initialized',
} as const;

export const DIARY_LEGACY_KEYS = [
  'vector_data_local-user',
  'vector_data_guest',
  'vector_data_undefined',
  'vector_data_',
  'safeDiaryRecords',
  'encryptedNotes',
  'journalList',
  'records',
  'notesData',
  'diary_entries',
] as const;

export const getSelectedStarsStorageKey = (uid: string | undefined) =>
  `vector_selected_stars_${uid || 'default'}`;
export const getMaterialsStorageKey = (uid: string | undefined) =>
  `vector_materials_${uid || 'default'}`;

export const getDiaryStorageKeys = (uid: string | undefined) => ({
  entries: DiaryStorageKeys.entries,
  principles: DiaryStorageKeys.principles,
  passwordHash: DiaryStorageKeys.passwordHash,
  passwordSalt: DiaryStorageKeys.passwordSalt,
  guidingStars: DiaryStorageKeys.guidingStars,
  selectedStars: getSelectedStarsStorageKey(uid),
  materials: getMaterialsStorageKey(uid),
  containers: DiaryStorageKeys.containers,
  deviceKeypair: DiaryStorageKeys.deviceKeypair,
  license: DiaryStorageKeys.license,
  backup: DiaryStorageKeys.backup,
  initializedFlag: DiaryStorageKeys.initializedFlag,
});

export function mirrorDiaryValue(key: string, value: string): boolean {
  if (
    value.length > MIRROR_SKIP_LIMIT &&
    (key === DiaryStorageKeys.entries || key === DiaryStorageKeys.backup)
  ) {
    console.log(`Vector Vault: Data for ${key} is large, skipping localStorage mirror.`);
    return false;
  }

  return setStoredString(key, value);
}

export function readDiaryJson<T>(key: string): T | undefined {
  return getStoredJson<T>(key) ?? undefined;
}

export function readDiaryString(key: string): string | undefined {
  return getStoredString(key) ?? undefined;
}

export function removeDiaryMirror(key: string) {
  removeStoredValue(key);
}

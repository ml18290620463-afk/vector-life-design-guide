export const AppStorageKeys = {
  theme: 'vector_theme',
  customIdentity: 'vector_custom_identity',
  recoveryVerifier: 'vector_recovery_hash',
  aiProvider: 'user_ai_provider',
  legacyAiApiKey: 'user_ai_key',
  vaultUnlocked: 'vector_vault_unlocked',
  draftTitle: 'neonlog_draft_title',
  draftContent: 'neonlog_draft_content',
  draftTags: 'neonlog_draft_tags',
  /**
   * Timestamp (`Date.now()` ms) of the last successful "Export Star Map"
   * backup. Used by `Dashboard` to show a "you haven't exported in
   * X days" banner once the gap exceeds `BACKUP_REMINDER_DAYS`.
   */
  lastBackupAt: 'vector_last_backup_at',
  /**
   * Phase 3 §3.g — timestamp of the last "not now" dismissal of the
   * PWA install banner. The banner stays hidden for
   * `usePwaInstallPrompt`'s `dismissalDays` (30 by default) so we
   * don't nag every visit.
   */
  pwaInstallDismissedAt: 'vector_pwa_install_dismissed_at',
  /**
   * Phase 3 §3.h — persisted share-card privacy options.
   * Stored as JSON: `{ showBody, showTags, showAttachmentBadge,
   *   theme }`. The `useShareCardOptions` hook owns the
   * read / write contract. Defaults intentionally privacy-on
   * (body masked) so an accidental "Share Card" tap never leaks
   * sensitive content.
   */
  shareCardOptions: 'vector_share_card_options',
  /**
   * Phase 3 §3.e-2 — per-installation feature flag for the Argon2id
   * verifier branch in `SecurityService.verifyPassword`. Stored as
   * the literal string `"1"` when on, removed when off.
   */
  argon2VerifierEnabled: 'vector_argon2_verify',
  /**
   * Phase 4 §W2.1 — per-installation feature flag for the Argon2id
   * MINTER branch in `SecurityService.hashPassword`. When on (and
   * `argon2VerifierEnabled` is also on, the "verify ≥ mint"
   * invariant), every NEW password hash is minted as Argon2id
   * instead of PBKDF2. Existing PBKDF2 hashes continue to verify
   * against the PBKDF2 branch.
   *
   * Phase 4 §W2.2 ships the Settings → Security toggle that flips
   * this through `SecurityService.setArgon2idMinterEnabled`.
   */
  argon2MinterEnabled: 'vector_argon2_minter',
  /**
   * Phase 4 §W2.4 — per-installation opt-in for the streaming Morning
   * Star endpoint. When set to `"1"`, the Viewer flow uses
   * `POST /api/morning-star/stream` (SSE) and shows an incremental
   * "thinking" preview as deltas arrive. When unset, falls back to
   * the buffered `POST /api/morning-star`.
   *
   * The streaming code path always attempts the SSE call first and
   * silently falls back to buffered on any transport failure, so this
   * flag only controls the UI affordance — turning it off does not
   * disable the streaming endpoint server-side.
   */
  morningStarStreamingEnabled: 'vector_morning_star_stream',
} as const;

/** How stale a backup must be before the Dashboard banner appears. */
export const BACKUP_REMINDER_DAYS = 60;
export const BACKUP_REMINDER_MS = BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;

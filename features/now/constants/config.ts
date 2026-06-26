export const CONFIG = {
  MAX_TEXT_LENGTH: 5000,
  MAX_IMAGES: 8,
  MAX_MOOD_TAGS: 3,
  MAX_EVENT_TAGS: 3,
  MIN_MOOD_TAGS: 1,
  MIN_EVENT_TAGS: 1,
  MAX_FOLLOWUP_ROUNDS: 2,
  SUFFICIENT_MIN_CHARS: 50,
  SUFFICIENT_MIN_MESSAGES: 2,
  SUFFICIENT_MIN_AUDIO_MS: 30000,
  ENABLE_OFFLINE_QUEUE: true,
  ENABLE_LIGHT_ACK: false,
} as const;

export const STORAGE_KEYS = {
  nowDraft: 'now_draft',
  avatarIntroShown: 'avatar_chat_intro_shown',
  customAnchors: 'user_custom_anchors',
  pendingRecords: 'pending_records',
} as const;

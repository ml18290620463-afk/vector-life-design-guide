import { AppStorageKeys } from './appSettings';
import { getStoredString, removeStoredValue, setStoredString } from './browserStorage';
import { SecurityService } from './securityService';

export interface EditorDraft {
  title: string;
  content: string;
  tags: string;
}

export type EditorDraftSaveReason = 'encrypt' | 'quota' | 'unknown';

export interface EditorDraftSaveResult {
  saved: boolean;
  reason?: EditorDraftSaveReason;
}

const emptyDraft: EditorDraft = {
  title: '',
  content: '',
  tags: '',
};

function safeGetItem(key: string): string {
  return getStoredString(key) ?? '';
}

function safeRemoveItem(key: string) {
  removeStoredValue(key);
}

/** Returns true on success; false when the underlying storage rejected (quota etc). */
function trySetItem(key: string, value: string): boolean {
  return setStoredString(key, value);
}

export async function loadEditorDraft(masterPassword: string | null): Promise<EditorDraft> {
  const draftTitle = safeGetItem(AppStorageKeys.draftTitle);
  const draftContent = safeGetItem(AppStorageKeys.draftContent);
  const draftTags = safeGetItem(AppStorageKeys.draftTags);

  let content = '';
  if (draftContent) {
    if (masterPassword && draftContent.startsWith('ENC:')) {
      try {
        content = await SecurityService.decrypt(draftContent.slice(4), masterPassword);
      } catch {
        content = '';
      }
    } else if (!draftContent.startsWith('ENC:')) {
      content = draftContent;
    }
  }

  return {
    title: draftTitle,
    content,
    tags: draftTags,
  };
}

export async function saveEditorDraft(
  draft: EditorDraft,
  masterPassword: string | null,
): Promise<EditorDraftSaveResult> {
  try {
    if (draft.title) {
      if (!trySetItem(AppStorageKeys.draftTitle, draft.title)) {
        return { saved: false, reason: 'quota' };
      }
    } else {
      safeRemoveItem(AppStorageKeys.draftTitle);
    }

    if (draft.tags) {
      if (!trySetItem(AppStorageKeys.draftTags, draft.tags)) {
        return { saved: false, reason: 'quota' };
      }
    } else {
      safeRemoveItem(AppStorageKeys.draftTags);
    }

    if (!draft.content) {
      safeRemoveItem(AppStorageKeys.draftContent);
      return { saved: true };
    }

    if (masterPassword) {
      let encrypted: string;
      try {
        encrypted = await SecurityService.encrypt(draft.content, masterPassword);
      } catch {
        // Drop the previous payload so we never silently keep stale plaintext
        // around if encryption breaks mid-session.
        safeRemoveItem(AppStorageKeys.draftContent);
        return { saved: false, reason: 'encrypt' };
      }
      if (!trySetItem(AppStorageKeys.draftContent, `ENC:${encrypted}`)) {
        return { saved: false, reason: 'quota' };
      }
      return { saved: true };
    }

    if (!trySetItem(AppStorageKeys.draftContent, draft.content)) {
      return { saved: false, reason: 'quota' };
    }
    return { saved: true };
  } catch {
    return { saved: false, reason: 'unknown' };
  }
}

export function clearEditorDraft() {
  safeRemoveItem(AppStorageKeys.draftTitle);
  safeRemoveItem(AppStorageKeys.draftContent);
  safeRemoveItem(AppStorageKeys.draftTags);
}

export function createEmptyEditorDraft(): EditorDraft {
  return { ...emptyDraft };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStorageKeys } from './appSettings';
import * as browserStorage from './browserStorage';
import { clearEditorDraft, loadEditorDraft, saveEditorDraft } from './editorDraft';
import { SecurityService } from './securityService';

describe('editorDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads a plaintext draft without a master password', async () => {
    localStorage.setItem(AppStorageKeys.draftTitle, 'Draft title');
    localStorage.setItem(AppStorageKeys.draftContent, 'Draft content');
    localStorage.setItem(AppStorageKeys.draftTags, 'tag-1, tag-2');

    await expect(loadEditorDraft(null)).resolves.toEqual({
      title: 'Draft title',
      content: 'Draft content',
      tags: 'tag-1, tag-2',
    });
  });

  it('saves encrypted content when a master password exists', async () => {
    const draft = { title: 'T', content: 'Secret text', tags: 'tag' };
    const result = await saveEditorDraft(draft, 'StrongPassword123!');

    expect(result).toEqual({ saved: true });
    expect(localStorage.getItem(AppStorageKeys.draftContent)?.startsWith('ENC:')).toBe(true);

    const loaded = await loadEditorDraft('StrongPassword123!');
    expect(loaded.content).toBe('Secret text');
  });

  it('does not persist plaintext content when encryption fails', async () => {
    vi.spyOn(SecurityService, 'encrypt').mockRejectedValueOnce(new Error('encrypt failed'));

    const result = await saveEditorDraft({ title: 'T', content: 'Secret text', tags: 'tag' }, 'pw');

    expect(result).toEqual({ saved: false, reason: 'encrypt' });
    expect(localStorage.getItem(AppStorageKeys.draftContent)).toBeNull();
    expect(localStorage.getItem(AppStorageKeys.draftTitle)).toBe('T');
  });

  it('reports a quota failure when localStorage rejects writes', async () => {
    const setSpy = vi
      .spyOn(browserStorage, 'setStoredString')
      .mockImplementation((key: string) => key !== AppStorageKeys.draftContent);

    const result = await saveEditorDraft({ title: 'T', content: 'Plain text', tags: 'tag' }, null);

    expect(result).toEqual({ saved: false, reason: 'quota' });
    expect(setSpy).toHaveBeenCalledWith(AppStorageKeys.draftContent, 'Plain text');
  });

  it('clears saved draft keys', async () => {
    localStorage.setItem(AppStorageKeys.draftTitle, 'Draft title');
    localStorage.setItem(AppStorageKeys.draftContent, 'Draft content');
    localStorage.setItem(AppStorageKeys.draftTags, 'tag');

    clearEditorDraft();

    expect(localStorage.getItem(AppStorageKeys.draftTitle)).toBeNull();
    expect(localStorage.getItem(AppStorageKeys.draftContent)).toBeNull();
    expect(localStorage.getItem(AppStorageKeys.draftTags)).toBeNull();
  });
});

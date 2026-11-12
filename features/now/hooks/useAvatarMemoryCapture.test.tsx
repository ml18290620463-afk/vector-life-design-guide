import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clear, set } from 'idb-keyval';
import { useAvatarMemoryCapture } from './useAvatarMemoryCapture';
import { aiPrivacyToken } from '../../../services/aiPrivacy';
import { DiaryStorageKeys } from '../../../services/diaryStorage';
import { readAvatarAtomicMemories } from '../../../services/avatarMemory';
import type { DiaryEntry } from '../../../types';

beforeEach(async () => {
  await clear();
  localStorage.clear();
});
afterEach(cleanup);

it('rejects a previously proposed memory after record permission is revoked', async () => {
  const entries: DiaryEntry[] = [
    {
      id: 'entry',
      content: '记录',
      title: '',
      tags: [],
      createdAt: 1,
      isLocked: false,
      aiVisibility: 'allowed',
      aiConsentAt: 1,
    },
  ];
  await set(DiaryStorageKeys.entries, entries);
  const showToast = vi.fn();
  const { result } = renderHook(() =>
    useAvatarMemoryCapture({
      draft: {
        text: '',
        materials: [],
        mood_tags: [],
        event_tags: [],
        record_time: '',
        display_time: '',
        updated_at: '',
      },
      sessionId: 'session',
      avatarMemoryReferences: [],
      showToast,
      refreshAvatarMemories: vi.fn(),
    }),
  );
  act(() =>
    result.current.considerAvatarName('小向', {
      id: 'message',
      role: 'user',
      type: 'text',
      content: '以后叫你小向',
      created_at: new Date().toISOString(),
      aiPrivacyToken: aiPrivacyToken(entries),
    }),
  );
  expect(result.current.companionSummary).not.toBeNull();
  await set(DiaryStorageKeys.entries, [{ ...entries[0], aiVisibility: 'private', aiConsentAt: 2 }]);
  let confirmation: Promise<unknown> | undefined;
  act(() => {
    confirmation = result.current.confirmMemory([], 'profile', 'explicit');
  });
  render(<>{result.current.dialog}</>);
  fireEvent.click(screen.getByRole('button', { name: /仅自己可见/ }));
  await act(async () => { await confirmation; });
  expect(readAvatarAtomicMemories()).toHaveLength(0);
  expect(result.current.companionSummary).toBeNull();
  expect(showToast).toHaveBeenCalledWith('记录的 AI 权限已变化，请重新提炼后确认');
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiaryEntry } from '../../types';
import { NowFlow } from './NowFlow';

vi.mock('./hooks/useNowDraft', () => ({
  useNowDraft: () => ({
    draft: {
      text: '实际执行后，会议先确认目标，讨论明显更聚焦。',
      materials: [],
      mood_tags: ['平静'],
      event_tags: ['个人成长'],
      record_time: '2026-07-16T07:00:00.000Z',
      display_time: '2026年7月16日15点',
      updated_at: '2026-07-16T07:00:00.000Z',
    },
    setDraft: vi.fn(),
    saveDraft: vi.fn(),
    discardDraft: vi.fn(),
    resetAfterSend: vi.fn(),
  }),
}));

vi.mock('./hooks/useToast', () => ({
  useToast: () => ({ toastMessage: null, showToast: vi.fn() }),
}));

vi.mock('./components/NowPage', () => ({
  NowPage: ({ onSend }: { onSend: () => void }) => (
    <button type="button" onClick={onSend}>
      save-result
    </button>
  ),
}));

vi.mock('./components/TagSelectPage', () => ({ TagSelectPage: () => null }));
vi.mock('./components/AvatarChatPage', () => ({
  AvatarChatPage: ({ onSend }: { onSend: (preview: object, sessionId: string) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSend(
          {
            text: '实际执行后，会议先确认目标，讨论明显更聚焦。',
            mood_tags: ['平静'],
            event_tags: ['个人成长'],
            principle_outcome: 'helpful',
          },
          'session-1',
        )
      }
    >
      save-reviewed-result
    </button>
  ),
}));
vi.mock('./api/records', () => ({ postRecord: vi.fn().mockResolvedValue({}) }));
vi.mock('../../services/neuralSemanticRecall', () => ({
  findNeuralRelatedEntryIds: vi.fn().mockResolvedValue([]),
}));

describe('NowFlow action review', () => {
  it('links a review entry to its action and principle before closing the action', async () => {
    const onPersistRecord = vi.fn(
      async (payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>): Promise<DiaryEntry> => ({
        ...payload,
        id: 'result-entry',
        createdAt: 2,
        isLocked: false,
      }),
    );
    const onActionResultRecorded = vi.fn();

    render(
      <NowFlow
        route="now"
        theme="dark"
        language="zh"
        onRouteChange={vi.fn()}
        onExit={vi.fn()}
        onPersistRecord={onPersistRecord}
        avatarLaunchContext={{
          mode: 'review',
          source: 'action-review',
          actionId: 'action-1',
        }}
        actions={[
          {
            id: 'action-1',
            title: '先确认会议目标',
            status: 'active',
            principleId: 'principle-1',
            createdAt: 1,
          },
        ]}
        onActionResultRecorded={onActionResultRecorded}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'save-result' }));

    await waitFor(() =>
      expect(onPersistRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedActionIds: ['action-1'],
          relatedPrincipleIds: ['principle-1'],
        }),
      ),
    );
    expect(onActionResultRecorded).toHaveBeenCalledWith('action-1', 'result-entry');
  });

  it('writes confirmed action feedback into the result and evolves principle confidence', async () => {
    const onPersistRecord = vi.fn(
      async (payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>): Promise<DiaryEntry> => ({
        ...payload,
        id: 'result-entry',
        createdAt: 2,
        isLocked: false,
      }),
    );
    const onUpdatePrinciple = vi.fn();

    render(
      <NowFlow
        route="avatar-chat"
        theme="dark"
        language="zh"
        onRouteChange={vi.fn()}
        onExit={vi.fn()}
        onPersistRecord={onPersistRecord}
        avatarLaunchContext={{ mode: 'review', source: 'action-review', actionId: 'action-1' }}
        actions={[
          {
            id: 'action-1',
            title: '先确认会议目标',
            status: 'active',
            principleId: 'principle-1',
            createdAt: 1,
          },
        ]}
        principles={[
          {
            id: 'principle-1',
            text: '重要沟通前先定义目标',
            year: 2026,
            createdAt: 1,
            showOnHome: true,
            confidence: 0.5,
          },
        ]}
        onUpdatePrinciple={onUpdatePrinciple}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'save-reviewed-result' }));

    await waitFor(() =>
      expect(onPersistRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          principleFeedback: [
            expect.objectContaining({ principleId: 'principle-1', outcome: 'helpful' }),
          ],
        }),
      ),
    );
    expect(onUpdatePrinciple).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'principle-1', confidence: 0.62, helpfulCount: 1 }),
    );
  });
});

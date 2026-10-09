import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryEntry } from '../../types';
import { NowFlow } from './NowFlow';

const draftControls = vi.hoisted(() => ({
  submissionId: undefined as string | undefined,
  reset: vi.fn().mockResolvedValue(true),
}));

vi.mock('./hooks/useNowDraft', () => ({
  useNowDraft: () => ({
    draft: {
      submission_id: draftControls.submissionId,
      text: '实际执行后，会议先确认目标，讨论明显更聚焦。',
      materials: [],
      mood_tags: ['平静'],
      event_tags: ['个人成长'],
      record_time: '2026-07-16T07:00:00.000Z',
      display_time: '2026年7月16日15点',
      updated_at: '2026-07-16T07:00:00.000Z',
    },
    setDraft: vi.fn(),
    saveDraft: vi.fn().mockResolvedValue(true),
    discardDraft: vi.fn(),
    resetAfterSend: draftControls.reset,
    ready: true,
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
  beforeEach(() => {
    draftControls.submissionId = undefined;
    draftControls.reset.mockClear();
  });
  it('keeps semantic analysis running when its past-page presentation is hidden', async () => {
    const pastEntry: DiaryEntry = {
      id: 'past-meeting',
      title: '2026年7月15日',
      content: '会议先确认目标，讨论会更聚焦。',
      createdAt: 1,
      tags: ['心情:平静', '事件:个人成长'],
      isLocked: false,
    };
    const onPersistRecord = vi.fn(
      async (payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>): Promise<DiaryEntry> => ({
        ...payload,
        id: 'result-entry',
        createdAt: 2,
        isLocked: false,
      }),
    );

    render(
      <NowFlow
        route="now"
        theme="dark"
        language="zh"
        onRouteChange={vi.fn()}
        onExit={vi.fn()}
        onPersistRecord={onPersistRecord}
        pastEntries={[pastEntry]}
        principles={[
          {
            id: 'principle-1',
            text: '重要沟通前先定义目标',
            year: 2026,
            createdAt: 1,
            showOnHome: true,
            derivedFromEntryIds: [pastEntry.id],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'save-result' }));

    await waitFor(() =>
      expect(onPersistRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedEntryIds: [pastEntry.id],
          relatedPrincipleIds: ['principle-1'],
          experienceEdges: [
            expect.objectContaining({
              targetEntryId: pastEntry.id,
              kind: 'sameTheme',
              source: 'local-semantic',
            }),
          ],
        }),
      ),
    );
  });

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

  it('offers review after saving without prompting an immediate action', async () => {
    const onReviewSavedRecord = vi.fn();
    const onOpenFutureAction = vi.fn();
    render(
      <NowFlow
        route="now"
        theme="dark"
        language="zh"
        onRouteChange={vi.fn()}
        onExit={vi.fn()}
        onPersistRecord={async (payload) => ({
          ...payload,
          id: 'saved-entry',
          createdAt: 2,
          isLocked: false,
        })}
        onReviewSavedRecord={onReviewSavedRecord}
        onOpenFutureAction={onOpenFutureAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'save-result' }));
    await screen.findByRole('heading', { name: '经历已保存' });
    fireEvent.click(screen.getByRole('button', { name: '回看这段经历' }));
    expect(onReviewSavedRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved-entry' }),
    );
    expect(screen.queryByRole('button', { name: '设计下一次尝试' })).toBeNull();
    expect(onOpenFutureAction).not.toHaveBeenCalled();
  });
});

describe('NowFlow interrupted completion', () => {
  it('retries failed action completion without saving the diary twice or clearing the draft early', async () => {
    draftControls.submissionId = undefined;
    draftControls.reset.mockClear();
    const onPersistRecord = vi.fn(async (payload) => ({
      ...payload,
      id: 'saved',
      createdAt: 2,
      isLocked: false,
    }));
    const onActionResultRecorded = vi
      .fn()
      .mockRejectedValueOnce(new Error('行动保存失败'))
      .mockResolvedValue(undefined);
    render(
      <NowFlow
        route="now"
        theme="dark"
        language="zh"
        onRouteChange={vi.fn()}
        onExit={vi.fn()}
        onPersistRecord={onPersistRecord}
        avatarLaunchContext={{ mode: 'review', source: 'action-review', actionId: 'a' }}
        actions={[{ id: 'a', title: '尝试', status: 'active', createdAt: 1 }]}
        onActionResultRecorded={onActionResultRecorded}
      />,
    );
    fireEvent.click(screen.getByText('save-result'));
    await screen.findByText('重试未完成处理');
    expect(draftControls.reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('重试未完成处理'));
    await waitFor(() => expect(draftControls.reset).toHaveBeenCalledOnce());
    expect(onPersistRecord).toHaveBeenCalledOnce();
    expect(onActionResultRecorded).toHaveBeenCalledTimes(2);
  });
  it('resumes a previously saved draft submission after remount without adding another record', async () => {
    draftControls.submissionId = 'saved';
    draftControls.reset.mockClear();
    const onPersistRecord = vi.fn();
    const onActionResultRecorded = vi.fn();
    render(
      <NowFlow
        route="now"
        theme="dark"
        language="zh"
        onRouteChange={vi.fn()}
        onExit={vi.fn()}
        onPersistRecord={onPersistRecord}
        pastEntries={[
          {
            id: 'saved',
            title: '已保存',
            content: '实际尝试后的记录',
            tags: [],
            createdAt: 2,
            isLocked: false,
            relatedActionIds: ['a'],
          },
        ]}
        actions={[{ id: 'a', title: '尝试', status: 'active', createdAt: 1 }]}
        onActionResultRecorded={onActionResultRecorded}
      />,
    );
    fireEvent.click(screen.getByText('继续完成'));
    await waitFor(() => expect(draftControls.reset).toHaveBeenCalledOnce());
    expect(onPersistRecord).not.toHaveBeenCalled();
    expect(onActionResultRecorded).toHaveBeenCalledWith('a', 'saved');
    draftControls.submissionId = undefined;
  });
});

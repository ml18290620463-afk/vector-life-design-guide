import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('NowFlow pure capture', () => {
  beforeEach(() => {
    draftControls.submissionId = undefined;
    draftControls.reset.mockReset().mockResolvedValue(true);
  });
  it('saves raw records without associating actions, principles or memories', async () => {
    const onPersistRecord = vi.fn(async (payload) => ({
      ...payload,
      id: 'saved',
      createdAt: 2,
      isLocked: false,
      tags: [],
    }));
    const onReviewSavedRecord = vi.fn();
    const onRelatedEntriesResolved = vi.fn();
    const onActionResultRecorded = vi.fn();
    const onUpdatePrinciple = vi.fn();
    render(
      <NowFlow
        route="now"
        theme="dark"
        language="zh"
        onRouteChange={vi.fn()}
        onExit={vi.fn()}
        onPersistRecord={onPersistRecord}
        onReviewSavedRecord={onReviewSavedRecord}
        onRelatedEntriesResolved={onRelatedEntriesResolved}
        onActionResultRecorded={onActionResultRecorded}
        onUpdatePrinciple={onUpdatePrinciple}
        avatarLaunchContext={{ mode: 'review', source: 'action-review', actionId: 'a' }}
        actions={[{ id: 'a', title: '会议', status: 'active', createdAt: 1, principleId: 'p' }]}
        pastEntries={[
          {
            id: 'old',
            title: '会议',
            content: '会议先确认目标，讨论明显更聚焦。',
            createdAt: 1,
            isLocked: false,
            tags: [],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('save-result'));
    await waitFor(() => expect(draftControls.reset).toHaveBeenCalled());
    await waitFor(() =>
      expect(onReviewSavedRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'saved' })),
    );
    expect(screen.queryByRole('heading', { name: '已保存' })).toBeNull();
    const payload = onPersistRecord.mock.calls[0][0];
    for (const key of [
      'relatedEntryIds',
      'relatedPrincipleIds',
      'relatedActionIds',
      'experienceEdges',
      'principleFeedback',
    ])
      expect(payload[key]).toBeUndefined();
    expect(onRelatedEntriesResolved).not.toHaveBeenCalled();
    expect(onActionResultRecorded).not.toHaveBeenCalled();
    expect(onUpdatePrinciple).not.toHaveBeenCalled();
  });
  it('opens Past immediately even while draft cleanup is pending', async () => {
    let finishCleanup!: (value: boolean) => void;
    draftControls.reset.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishCleanup = resolve;
        }),
    );
    const onReviewSavedRecord = vi.fn();
    const onPersistRecord = vi.fn(async (payload) => ({
      ...payload,
      id: 'saved',
      createdAt: 2,
      isLocked: false,
      tags: [],
    }));
    render(
      <NowFlow
        route="now"
        theme="dark"
        language="zh"
        onRouteChange={vi.fn()}
        onExit={vi.fn()}
        onPersistRecord={onPersistRecord}
        onReviewSavedRecord={onReviewSavedRecord}
      />,
    );
    fireEvent.click(screen.getByText('save-result'));
    await waitFor(() => expect(onReviewSavedRecord).toHaveBeenCalledOnce());
    expect(screen.queryByText('记录已保存，草稿待清理。')).toBeNull();
    expect(onPersistRecord).toHaveBeenCalledOnce();
    finishCleanup(false);
    await waitFor(() => expect(draftControls.reset).toHaveBeenCalledOnce());
  });
  it('resumes cleanup of a persisted submission after remount', async () => {
    draftControls.submissionId = 'saved';
    const onPersistRecord = vi.fn();
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
            content: '经历',
            tags: [],
            createdAt: 2,
            isLocked: false,
          },
        ]}
      />,
    );
    expect(screen.queryByText('继续完成')).toBeNull();
    await waitFor(() => expect(draftControls.reset).toHaveBeenCalledOnce());
    expect(onPersistRecord).not.toHaveBeenCalled();
  });
});

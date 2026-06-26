import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMemoirBuilder } from './useMemoirBuilder';

const completeAnswers = {
  name: '奶奶',
  relationship: '我的奶奶',
  voice: '"心里再苦,脸上也要带笑。"',
  memories: '小时候每个周末她会煮红烧肉。她总在我考砸时拍拍我的头说"不要紧"。',
  wishes: '希望在我焦虑时听她说"不要紧"',
};

const fillAll = (
  result: { current: ReturnType<typeof useMemoirBuilder> },
  answers = completeAnswers,
) => {
  for (const [id, value] of Object.entries(answers)) {
    act(() => {
      result.current.setAnswer(id, value);
    });
  }
};

const successResponse = () =>
  new Response(
    JSON.stringify({
      memoir: {
        name: '奶奶',
        description: '我心中的奶奶,陪我走过焦虑的夜晚',
        systemPrompt: '你是奶奶,是用户心中的奶奶。'.padEnd(1500, '。'),
      },
      provider: 'openrouter',
      requestId: 'req-1',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

describe('useMemoirBuilder', () => {
  describe('initialisation + step navigation', () => {
    it('starts at step 0 with phase=asking and 5 total steps', () => {
      const { result } = renderHook(() => useMemoirBuilder());
      expect(result.current.stepIndex).toBe(0);
      expect(result.current.phase).toBe('asking');
      expect(result.current.totalSteps).toBe(5);
      expect(result.current.currentStep.id).toBe('name');
      expect(result.current.consentAcknowledged).toBe(false);
    });

    it('refuses goNext when current required step is empty', () => {
      const { result } = renderHook(() => useMemoirBuilder());
      act(() => {
        result.current.goNext();
      });
      expect(result.current.stepIndex).toBe(0);
    });

    it('advances when current step is filled', () => {
      const { result } = renderHook(() => useMemoirBuilder());
      act(() => {
        result.current.setAnswer('name', '奶奶');
      });
      act(() => {
        result.current.goNext();
      });
      expect(result.current.stepIndex).toBe(1);
      expect(result.current.currentStep.id).toBe('relationship');
    });

    it('skips through optional `wishes` step with empty value', () => {
      const { result } = renderHook(() => useMemoirBuilder());
      // Fill required steps 1-4.
      act(() => {
        result.current.setAnswer('name', completeAnswers.name);
        result.current.setAnswer('relationship', completeAnswers.relationship);
        result.current.setAnswer('voice', completeAnswers.voice);
        result.current.setAnswer('memories', completeAnswers.memories);
      });
      // Walk 0 → 1 → 2 → 3 → 4 (last step = wishes, optional).
      for (let i = 0; i < 4; i += 1) {
        act(() => {
          result.current.goNext();
        });
      }
      expect(result.current.currentStep.id).toBe('wishes');
      // Already on the last step → goNext is a no-op even if optional empty.
      act(() => {
        result.current.goNext();
      });
      expect(result.current.currentStep.id).toBe('wishes');
    });
  });

  describe('isReadyToSubmit', () => {
    it('is false until every required field is filled', () => {
      const { result } = renderHook(() => useMemoirBuilder());
      expect(result.current.isReadyToSubmit).toBe(false);
      act(() => {
        result.current.setAnswer('name', '奶奶');
        result.current.setAnswer('relationship', '我的奶奶');
        result.current.setAnswer('voice', '不要紧');
      });
      expect(result.current.isReadyToSubmit).toBe(false); // missing memories
      act(() => {
        result.current.setAnswer('memories', '一起吃晚饭');
      });
      expect(result.current.isReadyToSubmit).toBe(true);
    });
  });

  describe('submit', () => {
    it('rejects submission when consent is NOT acknowledged', async () => {
      const fetcher = vi.fn().mockResolvedValue(successResponse());
      const { result } = renderHook(() => useMemoirBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);
      // Note: do NOT call setConsentAcknowledged.
      let returned;
      await act(async () => {
        returned = await result.current.submit();
      });
      expect(returned).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('error');
      expect(result.current.errorMessage).toBe('CONSENT_NOT_ACKNOWLEDGED');
    });

    it('rejects submission when required answers are missing', async () => {
      const fetcher = vi.fn();
      const { result } = renderHook(() => useMemoirBuilder({ fetcher: fetcher as typeof fetch }));
      act(() => {
        result.current.setConsentAcknowledged(true);
      });
      let returned;
      await act(async () => {
        returned = await result.current.submit();
      });
      expect(returned).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
      expect(result.current.errorMessage).toBe('SOME_REQUIRED_ANSWERS_MISSING');
    });

    it('on success, mints a memoir (kind=memoir) and flips phase=preview', async () => {
      const fetcher = vi.fn().mockResolvedValue(successResponse());
      const { result } = renderHook(() => useMemoirBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);
      act(() => {
        result.current.setConsentAcknowledged(true);
      });

      let memoir;
      await act(async () => {
        memoir = await result.current.submit();
      });

      expect(fetcher).toHaveBeenCalledWith(
        '/api/memoir-build',
        expect.objectContaining({ method: 'POST' }),
      );

      expect(memoir).not.toBeNull();
      expect(memoir!.kind).toBe('memoir');
      expect(memoir!.id).toMatch(/^memoir-/);
      expect(memoir!.builderAnswers?.name).toBe('奶奶');
      expect(result.current.phase).toBe('preview');
    });

    it('flips phase=error when server returns malformed body', async () => {
      const fetcher = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ memoir: { name: 'X' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const { result } = renderHook(() => useMemoirBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);
      act(() => {
        result.current.setConsentAcknowledged(true);
      });
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.errorMessage).toBe('MEMOIR_PAYLOAD_MISSING');
    });
  });

  describe('reset', () => {
    it('clears answers + step + phase + memoir + consent', async () => {
      const fetcher = vi.fn().mockResolvedValue(successResponse());
      const { result } = renderHook(() => useMemoirBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);
      act(() => {
        result.current.setConsentAcknowledged(true);
      });
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.phase).toBe('preview');

      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('asking');
      expect(result.current.stepIndex).toBe(0);
      expect(result.current.answers).toEqual({});
      expect(result.current.generatedMemoir).toBeNull();
      expect(result.current.consentAcknowledged).toBe(false);
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePersonaBuilder } from './usePersonaBuilder';

const completeAnswers = {
  name: '乔布斯',
  context: 'Apple 创始人',
  philosophy: '极简 + 用户体验至上',
  voice: 'Stay hungry, stay foolish.',
  style: '直接、富有禅意',
  avoid: '不要客套',
};

const fillAll = (
  result: { current: ReturnType<typeof usePersonaBuilder> },
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
      persona: {
        name: '乔布斯',
        description: 'Apple 创始人 / 极客哲学家',
        systemPrompt: 'You are 乔布斯, ...'.padEnd(800, '.'),
      },
      provider: 'openrouter',
      requestId: 'req-1',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

describe('usePersonaBuilder', () => {
  describe('initialisation + step navigation', () => {
    it('starts at step 0 with phase=asking', () => {
      const { result } = renderHook(() => usePersonaBuilder());
      expect(result.current.stepIndex).toBe(0);
      expect(result.current.phase).toBe('asking');
      expect(result.current.totalSteps).toBe(6);
      expect(result.current.currentStep.id).toBe('name');
    });

    it('refuses goNext when current required step is empty', () => {
      const { result } = renderHook(() => usePersonaBuilder());
      act(() => {
        result.current.goNext();
      });
      expect(result.current.stepIndex).toBe(0);
    });

    it('advances when current step is filled', () => {
      const { result } = renderHook(() => usePersonaBuilder());
      act(() => {
        result.current.setAnswer('name', '乔布斯');
      });
      act(() => {
        result.current.goNext();
      });
      expect(result.current.stepIndex).toBe(1);
      expect(result.current.currentStep.id).toBe('context');
    });

    it('skips through optional steps even with empty values', () => {
      const { result } = renderHook(() => usePersonaBuilder());
      // The 4th step (index 3) is `voice`, which is optional. Fill
      // all required steps and try to move past `voice` without
      // setting any voice answer.
      act(() => {
        result.current.setAnswer('name', completeAnswers.name);
        result.current.setAnswer('context', completeAnswers.context);
        result.current.setAnswer('philosophy', completeAnswers.philosophy);
      });
      // Walk through 0 → 1 → 2 → 3
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });
      expect(result.current.currentStep.id).toBe('voice');
      // Optional → goNext succeeds without filling
      act(() => {
        result.current.goNext();
      });
      expect(result.current.currentStep.id).toBe('style');
    });

    it('goBack moves back to previous step (clamped at 0)', () => {
      const { result } = renderHook(() => usePersonaBuilder());
      act(() => {
        result.current.setAnswer('name', '乔布斯');
        result.current.goNext();
      });
      act(() => {
        result.current.goBack();
      });
      expect(result.current.stepIndex).toBe(0);
      // Already at 0 — stays at 0.
      act(() => {
        result.current.goBack();
      });
      expect(result.current.stepIndex).toBe(0);
    });
  });

  describe('isReadyToSubmit', () => {
    it('is false until every required field is filled', () => {
      const { result } = renderHook(() => usePersonaBuilder());
      expect(result.current.isReadyToSubmit).toBe(false);
      act(() => {
        result.current.setAnswer('name', '乔布斯');
        result.current.setAnswer('context', 'Apple');
        result.current.setAnswer('philosophy', '极简');
      });
      expect(result.current.isReadyToSubmit).toBe(false); // missing `style`
      act(() => {
        result.current.setAnswer('style', '直接');
      });
      expect(result.current.isReadyToSubmit).toBe(true);
    });
  });

  describe('submit', () => {
    it('rejects submission when required answers are missing', async () => {
      const fetcher = vi.fn();
      const { result } = renderHook(() => usePersonaBuilder({ fetcher: fetcher as typeof fetch }));
      let returned;
      await act(async () => {
        returned = await result.current.submit();
      });
      expect(returned).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
      expect(result.current.phase).toBe('error');
      expect(result.current.errorMessage).toBe('SOME_REQUIRED_ANSWERS_MISSING');
    });

    it('on success, mints a persona and flips phase=preview', async () => {
      const fetcher = vi.fn().mockResolvedValue(successResponse());
      const { result } = renderHook(() => usePersonaBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);

      let persona;
      await act(async () => {
        persona = await result.current.submit();
      });

      expect(fetcher).toHaveBeenCalledWith(
        '/api/persona-build',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const callBody = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.answers.name).toBe('乔布斯');

      expect(persona).not.toBeNull();
      expect(persona!.kind).toBe('persona');
      expect(persona!.id).toMatch(/^persona-/);
      expect(persona!.builderAnswers?.name).toBe('乔布斯');

      expect(result.current.phase).toBe('preview');
      expect(result.current.generatedPersona?.id).toBe(persona!.id);
    });

    it('flips phase=error and surfaces detail on a 400 response', async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: 'Invalid wizard answers', detail: 'unknown field: foo' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      const { result } = renderHook(() => usePersonaBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.errorMessage).toBe('unknown field: foo');
    });

    it('flips phase=error on network rejection', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
      const { result } = renderHook(() => usePersonaBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.errorMessage).toBe('network down');
    });

    it('flips phase=error when server returns malformed body', async () => {
      const fetcher = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ persona: { name: 'X' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const { result } = renderHook(() => usePersonaBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.phase).toBe('error');
      expect(result.current.errorMessage).toBe('PERSONA_PAYLOAD_MISSING');
    });
  });

  describe('reset', () => {
    it('clears answers + step + phase + persona', async () => {
      const fetcher = vi.fn().mockResolvedValue(successResponse());
      const { result } = renderHook(() => usePersonaBuilder({ fetcher: fetcher as typeof fetch }));
      fillAll(result);
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
      expect(result.current.generatedPersona).toBeNull();
    });
  });
});

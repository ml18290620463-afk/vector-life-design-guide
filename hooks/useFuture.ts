import { useCallback, useEffect, useRef, useState } from 'react';
import type { FutureSnapshot } from '../types/future';
import { emptyFutureState, readFutureSnapshot } from '../services/futureRepository';
import { subscribeVault } from '../services/vaultTransaction';

export function useFuture() {
  const [snapshot, setSnapshot] = useState<FutureSnapshot>({
    state: emptyFutureState(),
    actions: [],
    protectedVault: false,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    try {
      const next = await readFutureSnapshot();
      if (id !== generation.current) return;
      setSnapshot(next);
      setError('');
      setReady(true);
    } catch (cause) {
      if (id !== generation.current) return;
      setSnapshot({ state: emptyFutureState(), actions: [], protectedVault: false });
      setError(cause instanceof Error ? cause.message : '读取失败，请重试');
      setReady(false);
    }
  }, []);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeVault(() => {
      void refresh();
    });
    return () => {
      invalidate();
      unsubscribe();
    };
  }, [refresh, invalidate]);
  return { ...snapshot, ready, error, refresh };
}

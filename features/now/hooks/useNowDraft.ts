import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNowDraft, saveNowDraft } from '../../../services/nowDraftRepository';
import type { NowDraft } from '../types/now';
import { createEmptyDraft } from '../state/nowRules';

export const useNowDraft = () => {
  const [draft, setDraftState] = useState<NowDraft>(createEmptyDraft);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('正在恢复草稿…');
  const [error, setError] = useState('');
  const current = useRef(draft);
  const revision = useRef(0);
  const saved = useRef('');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const alive = useRef(true);
  const dirty = useRef(false);
  const clearing = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setError('');
    void loadNowDraft()
      .then((row) => {
        if (cancelled) return;
        const restored = row.draft ?? createEmptyDraft();
        revision.current = row.revision;
        saved.current = JSON.stringify(restored);
        current.current = restored;
        setDraftState(restored);
        setReady(true);
        setStatus(row.draft ? '已恢复草稿' : '');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '草稿恢复失败，请重试');
      });
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [loadAttempt]);
  const setDraft = useCallback((updater: NowDraft | ((value: NowDraft) => NowDraft)) => {
    if (clearing.current) return;
    const next = typeof updater === 'function' ? updater(current.current) : updater;
    current.current = { ...next, updated_at: new Date().toISOString() };
    dirty.current = true;
    setDraftState(current.current);
    setStatus('草稿待保存');
  }, []);
  const persist = useCallback((snapshot: NowDraft | null) => {
    const epoch = generation.current;
    const run = async () => {
      if (snapshot && epoch !== generation.current) return true;
      const serialized = JSON.stringify(snapshot);
      if (snapshot && saved.current === serialized) return true;
      try {
        const result = await saveNowDraft(snapshot, revision.current);
        revision.current = result.revision;
        saved.current = serialized;
        dirty.current = snapshot !== null && JSON.stringify(current.current) !== serialized;
        if (alive.current) {
          setError('');
          setStatus(dirty.current ? '草稿待保存' : '草稿已保存在本机');
        }
        return true;
      } catch (err) {
        dirty.current = true;
        if (alive.current) {
          setError(err instanceof Error ? err.message : '草稿保存失败，请重试');
          setStatus('草稿尚未保存');
        }
        return false;
      }
    };
    const task = queue.current.then(run, run);
    queue.current = task;
    return task;
  }, []);
  const saveDraft = useCallback(
    (snapshot?: NowDraft) => {
      if (!ready || clearing.current) return Promise.resolve(false);
      if (snapshot) {
        current.current = snapshot;
        dirty.current = true;
        setDraftState(snapshot);
      }
      return persist(current.current);
    },
    [persist, ready],
  );
  useEffect(() => {
    if (!ready || !dirty.current) return;
    const timer = window.setTimeout(() => void saveDraft(), 350);
    return () => window.clearTimeout(timer);
  }, [draft, ready, saveDraft]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const flush = () => {
      if (dirty.current) void saveDraft();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', protect);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', protect);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, [saveDraft]);
  const discardDraft = useCallback(async () => {
    if (!ready || clearing.current) return false;
    clearing.current = true;
    generation.current += 1;
    const cleared = await persist(null);
    clearing.current = false;
    if (!cleared) return false;
    current.current = createEmptyDraft();
    saved.current = JSON.stringify(current.current);
    dirty.current = false;
    setDraftState(current.current);
    setStatus('');
    return true;
  }, [persist, ready]);
  return {
    draft,
    setDraft,
    saveDraft,
    discardDraft,
    resetAfterSend: discardDraft,
    ready,
    status,
    error,
    retryLoad: () => setLoadAttempt((value) => value + 1),
  };
};

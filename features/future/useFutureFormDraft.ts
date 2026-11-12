import { useEffect, useRef, useState, type RefObject } from 'react';
import { loadFutureDrafts, saveFutureDraft } from '../../services/futureDraftRepository';

export function useFutureFormDraft(
  key: string,
  editing: boolean,
  form: RefObject<HTMLFormElement | null>,
) {
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const revision = useRef(0);
  const committed = useRef(false);
  const submitting = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (!editing) return;
    let active = true;
    setReady(false);
    setLoadFailed(false);
    void loadFutureDrafts()
      .then((row) => {
        if (!active) return;
        revision.current = row.revision;
        const draft = row.drafts[key];
        if (draft && form.current) {
          for (const [name, value] of Object.entries(draft.fields)) {
            const element = form.current.elements.namedItem(name);
            if (
              element instanceof HTMLInputElement ||
              element instanceof HTMLTextAreaElement ||
              element instanceof HTMLSelectElement
            )
              element.value = value;
          }
          setMessage('已恢复本机加密草稿，保存后才会更新正式规划。');
        }
        setReady(true);
      })
      .catch((error) => {
        if (active) {
          setLoadFailed(true);
          setMessage(String(error instanceof Error ? error.message : error));
        }
      });
    return () => {
      active = false;
    };
  }, [key, editing, form, attempt]);
  const changed = () => {
    if (!ready || committed.current || !form.current) return;
    const fields = Object.fromEntries(
      Array.from(new FormData(form.current).entries()).map(([name, value]) => [
        name,
        String(value),
      ]),
    );
    setMessage('正在保存草稿…');
    queue.current = queue.current.then(async () => {
      const row = await saveFutureDraft(key, { fields, updatedAt: Date.now() }, revision.current);
      revision.current = row.revision;
      setMessage('草稿已加密保存在本机');
    });
    void queue.current.catch((error) =>
      setMessage(error instanceof Error ? error.message : '草稿保存失败，请复制文字后重试'),
    );
  };
  const finish = async (save: () => Promise<boolean | void> | boolean | void) => {
    if (submitting.current) return false;
    submitting.current = true;
    try {
      await queue.current;
      if (committed.current || (await save())) {
        committed.current = true;
        setSaved(true);
        const row = await saveFutureDraft(key, null, revision.current);
        revision.current = row.revision;
        return true;
      }
      return false;
    } catch (error) {
      setMessage(
        committed.current
          ? '正式内容已保存，草稿清理失败。请再次点击保存以重试清理；不会重复新增。'
          : error instanceof Error
            ? error.message
            : '草稿处理失败，请保留当前文字',
      );
      return false;
    } finally {
      submitting.current = false;
    }
  };
  return {
    ready,
    saved,
    loadFailed,
    retry: () => setAttempt((value) => value + 1),
    message,
    changed,
    finish,
  };
}

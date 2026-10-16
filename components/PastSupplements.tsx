import React, { useEffect, useRef, useState } from 'react';
import { get, set, del } from 'idb-keyval';
import type { DiaryEntry, Language } from '../types';
import { PastActionDialog } from './PastActionDialog';
import { generateSecureId } from '../services/idGenerator';
import { SecurityService } from '../services/securityService';

export function PastSupplements({
  entry,
  language,
  onAppend,
  draftPassword,
  revealedId,
}: {
  entry: DiaryEntry;
  language: Language;
  onAppend?: (entryId: string, content: string, supplementId: string) => Promise<void>;
  draftPassword?: string | null;
  revealedId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (revealedId) setShowAll(true);
  }, [revealedId]);
  const submission = useRef('');
  const pending = useRef(false);
  const draftVersion = useRef(0);
  const draftWrites = useRef<Promise<unknown>>(Promise.resolve());
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftKey = `past-supplement-draft:${entry.id}`;
  useEffect(() => {
    let active = true;
    ++draftVersion.current;
    setDraftLoaded(false);
    setContent('');
    void get<{ content: string; encrypted?: boolean }>(draftKey).then(async (draft) => {
      if (!active) return;
      if (!draft) {
        setDraftLoaded(true);
        return;
      }
      if (draft.encrypted && !draftPassword) return;
      try {
        const restored = draft.encrypted
          ? await SecurityService.decrypt(draft.content, draftPassword!)
          : draft.content;
        if (active) setContent(restored);
      } catch {
        // Keep an unreadable draft intact until the correct password is available.
        return;
      }
      if (active) setDraftLoaded(true);
    }).catch(() => { if (active) setDraftLoaded(true); });
    return () => { active = false; };
  }, [draftKey, draftPassword]);
  useEffect(() => {
    if (!draftLoaded) return;
    const version = ++draftVersion.current;
    const timer = window.setTimeout(() => {
      draftWrites.current = draftWrites.current.catch(() => undefined).then(async () => {
        if (version !== draftVersion.current) return;
        if (!content.trim()) { await del(draftKey); return; }
        const stored = draftPassword
          ? { content: await SecurityService.encrypt(content, draftPassword), encrypted: true }
          : { content, encrypted: false };
        if (version !== draftVersion.current) return;
        await set(draftKey, stored);
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [content, draftKey, draftLoaded, draftPassword]);
  const zh = language === 'zh';
  return (
    <div className="past-supplements">
      {(showAll ? entry.supplements : entry.supplements?.slice(-3))?.map((item) => (
        <section key={item.id} data-supplement-id={item.id} className="past-supplement">
          <time dateTime={new Date(item.createdAt).toISOString()}>
            {zh ? '补充 · ' : 'Supplement · '}
            {new Date(item.createdAt).toLocaleString(zh ? 'zh-CN' : 'en-US')}
          </time>
          <p>{item.content}</p>
        </section>
      ))}
      {(entry.supplements?.length ?? 0) > 3 && (
        <button type="button" className="past-supplements__open" onClick={() => setShowAll((value) => !value)}>
          {showAll ? (zh ? '收起补充' : 'Show less') : (zh ? `查看全部 ${entry.supplements!.length} 条补充` : `Show all ${entry.supplements!.length} supplements`)}
        </button>
      )}
      {onAppend && (
        <button
          type="button"
          className="past-supplements__open"
          onClick={() => {
            submission.current = generateSecureId('supplement');
            setOpen(true);
            setError('');
          }}
        >
          {zh ? '补充' : 'Add supplement'}
        </button>
      )}
      {open && (
        <PastActionDialog
          title={zh ? '补充' : 'Add supplement'}
          busy={busy}
          onCancel={() => setOpen(false)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!onAppend || pending.current || !draftLoaded || !content.trim()) return;
              pending.current = true;
              setBusy(true);
              setError('');
              try {
                await onAppend(entry.id, content, submission.current);
                ++draftVersion.current;
                await draftWrites.current.catch(() => undefined);
                await del(draftKey);
                setContent('');
                setOpen(false);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : zh
                      ? '保存失败，请重试'
                      : 'Save failed. Retry.',
                );
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          >
            <textarea
              aria-label={zh ? '补充内容' : 'Supplement content'}
              value={content}
              disabled={busy || !draftLoaded}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
            />
            {error && <p role="alert">{error}</p>}
            <div className="past-action-dialog__actions">
              <button type="button" data-cancel disabled={busy} onClick={() => setOpen(false)}>
                {zh ? '取消' : 'Cancel'}
              </button>
              <button type="submit" disabled={busy || !draftLoaded || !content.trim()}>
                {busy ? (zh ? '保存中…' : 'Saving…') : zh ? '保存' : 'Save'}
              </button>
            </div>
          </form>
        </PastActionDialog>
      )}
    </div>
  );
}

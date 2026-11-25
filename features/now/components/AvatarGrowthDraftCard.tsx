import React, { useState } from 'react';
import { loadFutureDrafts, saveFutureDraft } from '../../../services/futureDraftRepository';
import { UnifiedArtifactCard } from './UnifiedArtifactCard';
import { useAvatarLanguage } from './avatarLanguage';

/** A reply is only a proposal. The user edits and explicitly confirms the future draft. */
export function AvatarGrowthDraftCard({ suggestion, onOpenFuture }: {
  suggestion: string;
  onOpenFuture?: () => void;
}) {
  const { t } = useAvatarLanguage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const create = async () => {
    const value = title.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const snapshot = await loadFutureDrafts();
      if (snapshot.drafts['action:new']) {
        setStatus(t('已有未完成的未来行动草稿，请先在未来中处理。', 'A future action draft already exists. Review it in Future first.'));
        return;
      }
      await saveFutureDraft('action:new', { fields: { title: value }, updatedAt: Date.now() }, snapshot.revision);
      setStatus(t('草稿已保存，尚未成为正式行动。', 'Draft saved; it is not an active action yet.'));
      setOpen(false);
      onOpenFuture?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('保存草稿失败', 'Could not save draft'));
    } finally {
      setBusy(false);
    }
  };
  return <UnifiedArtifactCard kind="future" status="draft" className="avatar-growth-draft-card" actions={<>
    {!open && <button type="button" onClick={() => { setTitle(suggestion.slice(0, 120)); setOpen(true); }}>
      {t('生成下一步微行动草稿', 'Draft a next small action')}
    </button>}
    {open && <>
      <label htmlFor="avatar-growth-draft-title">{t('下一步微行动', 'Next small action')}</label>
      <input id="avatar-growth-draft-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
      <button type="button" disabled={busy || !title.trim()} onClick={() => void create()}>{t('确认保存草稿', 'Confirm draft')}</button>
      <button type="button" disabled={busy} onClick={() => setOpen(false)}>{t('取消', 'Cancel')}</button>
    </>}
    {status && <p role="status">{status}</p>}
  </>}>
    <p>{t('复盘后可整理下一步行动。请先核对并修改内容，保存草稿不会创建正式规划。', 'After reviewing, edit the next action. Saving a draft does not create an active plan.')}</p>
  </UnifiedArtifactCard>;
}

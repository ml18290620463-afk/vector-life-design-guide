import { tagLabel } from '../constants/tags';
import { useAvatarLanguage } from './avatarLanguage';
import React, { useEffect, useRef, useState } from 'react';
import { Anchor, ArrowLeft, Image, Link as LinkIcon, Plus, Video, Trash2 } from 'lucide-react';
import { CONFIG } from '../constants/config';
import { useMaterialPicker } from '../hooks/useMaterialPicker';
import { getCanSend, getDisabledSendReason, isDraftEmpty } from '../state/nowRules';
import type { Material, NowDraft, NowRoute } from '../types/now';
import { MaterialPreview } from './MaterialPreview';
import { normalizeWebMaterialUrl } from '../../../lib/materialPersistence';

interface NowPageProps {
  draft: NowDraft;
  setDraft: (updater: NowDraft | ((draft: NowDraft) => NowDraft)) => void;
  sending: boolean;
  onSend: () => void;
  onSaveDraft: () => Promise<boolean>;
  onDiscardDraft: () => Promise<boolean>;
  onExit: () => void;
  onRouteChange: (route: NowRoute) => void;
  showToast: (message: string) => void;
  mobileShell?: boolean;
}

export const NowPage: React.FC<NowPageProps> = ({
  draft,
  setDraft,
  sending,
  onSend,
  onSaveDraft,
  onDiscardDraft,
  onExit,
  onRouteChange,
  showToast,
  mobileShell = false,
}) => {
  const { t, language } = useAvatarLanguage();
  const [pastedUrl, setPastedUrl] = useState('');
  const [linkEditing, setLinkEditing] = useState<string | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const linkDialog = useRef<HTMLDialogElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (linkEditing === null) return;
    const node = linkDialog.current;
    const opener = document.activeElement as HTMLElement | null;
    node?.showModal();
    linkInput.current?.focus();
    return () => {
      node?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [linkEditing]);
  const [materialMenuOpen, setMaterialMenuOpen] = useState(false);
  const [removedMaterial, setRemovedMaterial] = useState<{
    material: Material;
    index: number;
  } | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitInFlight = useRef(false);
  const finishExit = async (discard: boolean) => {
    if (exitInFlight.current || sending || picker.isReading()) return;
    exitInFlight.current = true;
    setExiting(true);
    try {
      if (!(await (discard ? onDiscardDraft() : onSaveDraft()))) {
        showToast(
          discard
            ? t('草稿未能清除，请重试', 'Could not clear the draft. Please retry.')
            : t(
                '草稿保存失败，请继续编辑并重试',
                'Could not save the draft. Keep editing and retry.',
              ),
        );
        return;
      }
      setExitOpen(false);
      if (discard) {
        picker.clearFailures();
        setPastedUrl('');
      } else onExit();
    } catch {
      showToast(
        discard
          ? t('草稿未能清除，请重试', 'Could not clear the draft. Please retry.')
          : t(
              '草稿保存失败，请继续编辑并重试',
              'Could not save the draft. Keep editing and retry.',
            ),
      );
    } finally {
      exitInFlight.current = false;
      setExiting(false);
    }
  };
  const exitDialog = useRef<HTMLDialogElement>(null);
  const continueEditingButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!exitOpen) return;
    const node = exitDialog.current;
    const opener = document.activeElement as HTMLElement | null;
    node?.showModal();
    continueEditingButton.current?.focus();
    return () => {
      node?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [exitOpen]);
  const picker = useMaterialPicker({
    materials: draft.materials,
    onAdd: (materials) => {
      setDraft((current) => ({ ...current, materials: [...current.materials, ...materials] }));
    },
    onError: showToast,
  });
  const canSend = getCanSend(draft) && !picker.failures.length;
  const tagSummary = [...draft.event_tags, ...draft.mood_tags]
    .map((tag) => tagLabel(tag, language))
    .join(' · ');

  const handleImageImport = () => {
    setMaterialMenuOpen(false);
    picker.openImagePicker();
  };

  const handleVideoImport = () => {
    setMaterialMenuOpen(false);
    picker.openVideoPicker();
  };

  const handleLinkImport = () => {
    setMaterialMenuOpen(false);
    setLinkValue('');
    setLinkEditing('');
  };

  const handleBack = () => {
    if (sending || exitInFlight.current || picker.isReading()) return;
    if (picker.hasFailures()) {
      showToast(t('请重试或移除未读取的素材', 'Retry or remove the unread attachments.'));
      return;
    }
    if (isDraftEmpty(draft)) {
      onExit();
      return;
    }
    void finishExit(false);
  };

  const removeMaterial = (id: string) => {
    if (sending || exitInFlight.current || picker.isReading()) return;
    const index = draft.materials.findIndex((material) => material.id === id);
    if (index < 0) return;
    setRemovedMaterial({ material: draft.materials[index], index });
    setDraft((current) => ({
      ...current,
      materials: current.materials
        .filter((material) => material.id !== id)
        .map((material, index) => ({ ...material, sort_order: index })),
    }));
  };
  const moveMaterial = (id: string, offset: number) => {
    setDraft((current) => {
      const materials = [...current.materials];
      const from = materials.findIndex((item) => item.id === id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= materials.length) return current;
      [materials[from], materials[to]] = [materials[to], materials[from]];
      return {
        ...current,
        materials: materials.map((item, index) => ({ ...item, sort_order: index })),
      };
    });
  };
  const updateMaterialDescription = (id: string, description: string) => {
    if (sending || exitInFlight.current || picker.isReading()) return;
    setDraft((current) => ({
      ...current,
      materials: current.materials.map((material) =>
        material.id === id ? { ...material, description } : material,
      ),
    }));
  };
  const replaceMaterialLink = (id: string) => {
    if (sending || exitInFlight.current || picker.isReading()) return;
    const material = draft.materials.find((candidate) => candidate.id === id);
    if (!material) return;
    setLinkValue(material.url);
    setLinkEditing(id);
  };
  const submitLink = () => {
    if (sending || exiting) return;
    const url = normalizeWebMaterialUrl(linkValue);
    if (!url) {
      showToast(t('请输入有效的网页链接', 'Enter a valid web link.'));
      return;
    }
    if (linkEditing === '') {
      if (!picker.addLink(url)) return;
    } else {
      setDraft((current) => ({
        ...current,
        materials: current.materials.map((candidate) =>
          candidate.id === linkEditing
            ? { ...candidate, url, meta: { ...candidate.meta, title: url } }
            : candidate,
        ),
      }));
    }
    setLinkEditing(null);
  };

  return (
    // File drop and paste complement the keyboard-accessible file picker.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <main
      className="now-page"
      data-testid="now-page"
      onPaste={(event) => {
        if (!event.clipboardData.files.length) {
          const text = event.clipboardData.getData('text/plain').trim();
          if (/^(https?:\/\/|www\.)\S+$/i.test(text) && normalizeWebMaterialUrl(text))
            setPastedUrl(text);
          return;
        }
        if (sending || exiting || picker.isReading()) {
          event.preventDefault();
          return;
        }
        void picker.addFiles(event.clipboardData.files);
        if (!event.clipboardData.getData('text/plain')) event.preventDefault();
      }}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        if (!sending && !exiting && !picker.isReading())
          void picker.addFiles(event.dataTransfer.files);
      }}
    >
      <dialog
        ref={linkDialog}
        className="now-exit-dialog now-link-dialog"
        aria-labelledby="now-link-title"
        onCancel={() => setLinkEditing(null)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitLink();
          }}
        >
          <h2 id="now-link-title">
            {linkEditing ? t('替换链接', 'Replace link') : t('添加链接', 'Add link')}
          </h2>
          <label htmlFor="now-link-url" className="sr-only">
            {t('网页链接', 'Web link')}
          </label>
          <input
            id="now-link-url"
            ref={linkInput}
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="example.com"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
          />
          <div className="now-exit-dialog__actions">
            <button type="submit" disabled={sending || exiting || picker.reading}>
              {t('确定', 'Confirm')}
            </button>
            <button type="button" onClick={() => setLinkEditing(null)}>
              {t('取消', 'Cancel')}
            </button>
          </div>
        </form>
      </dialog>
      <header className="now-header">
        <button
          type="button"
          className="now-icon-button"
          onClick={handleBack}
          disabled={sending || exiting || picker.reading}
          aria-label={mobileShell ? t('返回过去', 'Back to Past') : t('返回', 'Back')}
        >
          <ArrowLeft size={20} />
        </button>
        <time className="now-time" dateTime={draft.record_time}>
          {draft.display_time}
        </time>
        {isDraftEmpty(draft) ? (
          <span className="now-header__spacer" aria-hidden="true" />
        ) : (
          <button
            type="button"
            className="now-tool-button"
            aria-label={t('清空草稿', 'Clear draft')}
            disabled={sending || exiting || picker.reading}
            onClick={() => setExitOpen(true)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </header>

      <div className={`now-card${isDraftEmpty(draft) ? ' now-card--empty' : ''}`}>
        <section className="now-editor">
          <div className="now-editor__surface">
            <label htmlFor="now-record-text" className="sr-only">
              {t('此刻发生了什么？', 'What is happening now?')}
            </label>
            <textarea
              id="now-record-text"
              value={draft.text}
              maxLength={CONFIG.MAX_TEXT_LENGTH}
              disabled={sending || exiting}
              onChange={(event) =>
                setDraft((current) => ({ ...current, text: event.target.value }))
              }
              placeholder={t('写下此刻', 'Write about this moment')}
              aria-describedby={
                draft.text.length >= CONFIG.MAX_TEXT_LENGTH * 0.9 ? 'now-record-count' : undefined
              }
            />
            {draft.text.length >= CONFIG.MAX_TEXT_LENGTH * 0.9 && (
              <div className="now-editor__meta">
                <span id="now-record-count" aria-live="polite">
                  {draft.text.length}/{CONFIG.MAX_TEXT_LENGTH}
                </span>
              </div>
            )}
          </div>
        </section>

        {pastedUrl && (
          <div className="now-pasted-link">
            <button
              type="button"
              disabled={sending || exiting || picker.reading}
              onClick={() => {
                if (picker.addLink(pastedUrl)) setPastedUrl('');
              }}
            >
              {t('添加为链接', 'Add as link')}
            </button>
            <button
              type="button"
              aria-label={t('忽略链接建议', 'Dismiss link suggestion')}
              onClick={() => setPastedUrl('')}
            >
              {t('关闭', 'Close')}
            </button>
          </div>
        )}
        {picker.failures.map((item) => (
          <div key={item.id} className="now-material-failure" role="alert">
            <span>
              {item.file.name} · {t('读取失败', 'Read failed')}
            </span>
            <button
              type="button"
              disabled={picker.reading}
              onClick={() => void picker.retryFailure(item.id)}
            >
              {t('重试', 'Retry')}
            </button>
            <button
              type="button"
              disabled={picker.reading}
              onClick={() => picker.removeFailure(item.id)}
            >
              {t('移除', 'Remove')}
            </button>
          </div>
        ))}
        {(draft.materials.length > 0 || removedMaterial) && (
          <div className="now-materials-row">
            {draft.materials.length > 0 && (
              <MaterialPreview
                materials={draft.materials}
                onRemove={removeMaterial}
                onMove={moveMaterial}
                onUpdateDescription={updateMaterialDescription}
                onReplaceLink={replaceMaterialLink}
              />
            )}
            {removedMaterial && (
              <button
                type="button"
                onClick={() => {
                  const { material, index } = removedMaterial;
                  setDraft((current) => {
                    if (current.materials.some((item) => item.id === material.id)) return current;
                    const next = [...current.materials];
                    next.splice(Math.min(index, next.length), 0, material);
                    return {
                      ...current,
                      materials: next.map((item, position) => ({ ...item, sort_order: position })),
                    };
                  });
                  setRemovedMaterial(null);
                }}
              >
                {t('撤销删除素材', 'Undo attachment removal')}
              </button>
            )}
          </div>
        )}

        <div className="now-actions">
          <div className="now-tool-row">
            <button
              type="button"
              className="now-anchor-point"
              onClick={() => onRouteChange('tags')}
              disabled={sending || exiting || picker.reading}
              aria-label={t('心情与事件', 'Mood and events')}
            >
              <span className="now-anchor-point__icon" aria-hidden="true">
                <Anchor size={20} />
              </span>
              <span className="now-anchor-point__meta">
                <span className="now-anchor-point__summary" title={tagSummary || undefined}>
                  {tagSummary || t('标签', 'Tags')}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={`now-tool-button now-tool-button--add ${materialMenuOpen ? 'is-open' : ''}`}
              disabled={sending || exiting || picker.reading}
              aria-label={
                materialMenuOpen
                  ? t('收起素材', 'Hide attachments')
                  : t('添加素材', 'Add attachment')
              }
              aria-expanded={materialMenuOpen}
              onClick={() => setMaterialMenuOpen((open) => !open)}
            >
              <Plus size={21} />
            </button>
          </div>
          {materialMenuOpen ? (
            <div className="now-material-popover" aria-label={t('素材类型', 'Attachment type')}>
              <button
                type="button"
                className="now-tool-button"
                disabled={sending || exiting || picker.reading}
                aria-label={t('图片', 'Image')}
                onClick={handleImageImport}
              >
                <Image size={19} aria-hidden="true" />
                <span>{t('图片', 'Image')}</span>
              </button>
              <button
                type="button"
                className="now-tool-button"
                disabled={sending || exiting || picker.reading}
                aria-label={t('视频', 'Video')}
                onClick={handleVideoImport}
              >
                <Video size={19} aria-hidden="true" />
                <span>{t('视频', 'Video')}</span>
              </button>
              <button
                type="button"
                className="now-tool-button"
                disabled={sending || exiting || picker.reading}
                aria-label={t('链接', 'Link')}
                onClick={handleLinkImport}
              >
                <LinkIcon size={19} aria-hidden="true" />
                <span>{t('链接', 'Link')}</span>
              </button>
            </div>
          ) : null}
        </div>

        <footer className="now-bottom-bar">
          <button
            type="button"
            className="now-send-button"
            data-state={sending ? 'loading' : canSend ? 'enabled' : 'disabled'}
            onClick={() => {
              if (picker.isReading() || sending || exiting) return;
              if (picker.hasFailures()) {
                showToast(t('请重试或移除未读取的素材', 'Retry or remove the unread attachments.'));
                return;
              }
              const reason = getDisabledSendReason(draft);
              if (reason) {
                showToast(t(reason));
                return;
              }
              onSend();
            }}
            aria-label={t('保存到过去', 'Save to Past')}
            aria-busy={sending || picker.reading}
            disabled={sending || exiting || picker.reading || picker.failures.length > 0}
          >
            <span>
              {picker.reading
                ? t('素材读取中…', 'Reading attachments…')
                : sending
                  ? t('保存中…', 'Saving…')
                  : t('保存', 'Save')}
            </span>
          </button>
        </footer>
      </div>
      {exitOpen && (
        <dialog
          ref={exitDialog}
          className="now-exit-dialog"
          aria-labelledby="now-exit-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!exiting) setExitOpen(false);
          }}
        >
          <h2 id="now-exit-title">{t('清空草稿？', 'Clear draft?')}</h2>
          <div className="now-exit-dialog__actions">
            <button type="button" disabled={exiting} onClick={() => void finishExit(true)}>
              {t('确认清空', 'Confirm clear')}
            </button>
            <button
              disabled={exiting}
              ref={continueEditingButton}
              type="button"
              onClick={() => setExitOpen(false)}
            >
              {t('继续编辑', 'Keep editing')}
            </button>
          </div>
        </dialog>
      )}
      <input
        ref={picker.imageInputRef}
        hidden
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          void picker.addFiles(event.target.files, 'image');
          event.target.value = '';
        }}
      />
      <input
        ref={picker.videoInputRef}
        hidden
        type="file"
        accept="video/*"
        onChange={(event) => {
          void picker.addFiles(event.target.files, 'video');
          event.target.value = '';
        }}
      />
    </main>
  );
};

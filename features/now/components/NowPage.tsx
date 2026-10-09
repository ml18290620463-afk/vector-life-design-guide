import React, { useEffect, useRef, useState } from 'react';
import { Anchor, ArrowLeft, Image, Link as LinkIcon, Plus, Video } from 'lucide-react';
import { CONFIG } from '../constants/config';
import { useMaterialPicker } from '../hooks/useMaterialPicker';
import { getCanSend, getDisabledSendReason, isDraftEmpty } from '../state/nowRules';
import type { NowDraft, NowRoute } from '../types/now';
import { MaterialPreview } from './MaterialPreview';

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
  const [materialMenuOpen, setMaterialMenuOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitInFlight = useRef(false);
  const finishExit = async (discard: boolean) => {
    if (exitInFlight.current || sending) return;
    exitInFlight.current = true;
    setExiting(true);
    try {
      if (!(await (discard ? onDiscardDraft() : onSaveDraft()))) {
        showToast(discard ? '草稿未能清除，请重试' : '草稿保存失败，请继续编辑并重试');
        return;
      }
      setExitOpen(false);
      if (!discard) onExit();
    } catch {
      showToast(discard ? '草稿未能清除，请重试' : '草稿保存失败，请继续编辑并重试');
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
  const canSend = getCanSend(draft);
  const tagSummary = [...draft.event_tags, ...draft.mood_tags].join(' · ');

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
    picker.addLink();
  };

  const handleBack = () => {
    if (sending || exitInFlight.current) return;
    if (isDraftEmpty(draft)) {
      onExit();
      return;
    }
    void finishExit(false);
  };

  const removeMaterial = (id: string) => {
    if (sending || exitInFlight.current) return;
    setDraft((current) => ({
      ...current,
      materials: current.materials.filter((material) => material.id !== id),
    }));
  };
  const updateMaterialDescription = (id: string, description: string) => {
    if (sending || exitInFlight.current) return;
    setDraft((current) => ({
      ...current,
      materials: current.materials.map((material) =>
        material.id === id ? { ...material, description } : material,
      ),
    }));
  };

  return (
    <main className="now-page" data-testid="now-page">
      <header className="now-header">
        <button
          type="button"
          className="now-icon-button"
          onClick={handleBack}
          disabled={sending || exiting}
          aria-label={mobileShell ? '返回过去' : '返回'}
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
            disabled={sending || exiting}
            onClick={() => setExitOpen(true)}
          >
            清空草稿
          </button>
        )}
      </header>

      <div className={`now-card${isDraftEmpty(draft) ? ' now-card--empty' : ''}`}>
        <section className="now-editor">
          <div className="now-editor__surface">
            <label htmlFor="now-record-text" className="sr-only">
              此刻发生了什么？
            </label>
            <textarea
              id="now-record-text"
              value={draft.text}
              maxLength={CONFIG.MAX_TEXT_LENGTH}
              disabled={sending || exiting}
              onChange={(event) =>
                setDraft((current) => ({ ...current, text: event.target.value }))
              }
              placeholder="写下此刻"
              aria-describedby="now-record-count now-record-guide"
            />
            <p id="now-record-guide" className="now-materials-hint">
              写下发生了什么，以及你在意的一点。保存后可在「过去」搜索找回，无需先选标签。
            </p>
            <div className="now-editor__meta">
              <span id="now-record-count" aria-live="polite">
                {draft.text.length}/{CONFIG.MAX_TEXT_LENGTH}
              </span>
            </div>
          </div>
        </section>

        <div className="now-materials-row">
          <MaterialPreview
            materials={draft.materials}
            onRemove={removeMaterial}
            onUpdateDescription={updateMaterialDescription}
          />
          <p className="now-materials-hint" id="now-materials-hint">
            素材是这次经历的证据；分身会结合这条记录理解，不会自动把素材当成结论。
          </p>
        </div>

        <div className="now-actions">
          <div className="now-tool-row">
            <button
              type="button"
              className="now-anchor-point"
              onClick={() => onRouteChange('tags')}
              disabled={sending || exiting}
              aria-label="心情与事件"
            >
              <span className="now-anchor-point__icon" aria-hidden="true">
                <Anchor size={20} />
              </span>
              <span className="now-anchor-point__meta">
                <span className="now-anchor-point__summary" title={tagSummary || undefined}>
                  {tagSummary || '标签（选填）'}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={`now-tool-button now-tool-button--add ${materialMenuOpen ? 'is-open' : ''}`}
              disabled={sending || exiting}
              aria-label={materialMenuOpen ? '收起素材' : '添加素材'}
              aria-expanded={materialMenuOpen}
              aria-describedby="now-materials-hint"
              onClick={() => setMaterialMenuOpen((open) => !open)}
            >
              <Plus size={21} />
            </button>
          </div>
          {materialMenuOpen ? (
            <div className="now-material-popover" aria-label="素材类型">
              <button
                type="button"
                className="now-tool-button"
                disabled={sending || exiting}
                aria-label="图片"
                onClick={handleImageImport}
              >
                <Image size={19} />
              </button>
              <button
                type="button"
                className="now-tool-button"
                disabled={sending || exiting}
                aria-label="视频"
                onClick={handleVideoImport}
              >
                <Video size={19} />
              </button>
              <button
                type="button"
                className="now-tool-button"
                disabled={sending || exiting}
                aria-label="链接"
                onClick={handleLinkImport}
              >
                <LinkIcon size={19} />
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
              const reason = getDisabledSendReason(draft);
              if (reason) {
                showToast(reason);
                return;
              }
              onSend();
            }}
            aria-label="保存到过去"
            disabled={sending || exiting}
          >
            <span>保存</span>
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
          <h2 id="now-exit-title">清空草稿？</h2>
          <div className="now-exit-dialog__actions">
            <button type="button" disabled={exiting} onClick={() => void finishExit(true)}>
              确认清空
            </button>
            <button
              disabled={exiting}
              ref={continueEditingButton}
              type="button"
              onClick={() => setExitOpen(false)}
            >
              继续编辑
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
        onChange={(event) => picker.addFiles(event.target.files, 'image')}
      />
      <input
        ref={picker.videoInputRef}
        hidden
        type="file"
        accept="video/*"
        onChange={(event) => picker.addFiles(event.target.files, 'video')}
      />
    </main>
  );
};

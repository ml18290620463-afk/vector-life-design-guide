import React, { useState } from 'react';
import { Anchor, ArrowLeft, ArrowUp, Bot, Check, Image, Link as LinkIcon, Plus, Video } from 'lucide-react';
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
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
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
  const picker = useMaterialPicker({
    materials: draft.materials,
    onAdd: (materials) => {
      setDraft((current) => ({ ...current, materials: [...current.materials, ...materials] }));
    },
    onError: showToast,
  });
  const canSend = getCanSend(draft);
  const hasMood = draft.mood_tags.length > 0;
  const hasEvent = draft.event_tags.length > 0;
  const tagProgress = Number(hasMood) + Number(hasEvent);
  const tagSummary = [...draft.mood_tags, ...draft.event_tags].slice(0, 2).join(' · ');

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
    if (isDraftEmpty(draft)) {
      onExit();
      return;
    }
    const choice = window.prompt('输入 1 保存草稿，输入 2 放弃，留空取消');
    if (choice === '1') {
      onSaveDraft();
      onExit();
    }
    if (choice === '2') {
      onDiscardDraft();
      onExit();
    }
  };

  const removeMaterial = (id: string) => {
    setDraft((current) => ({
      ...current,
      materials: current.materials.filter((material) => material.id !== id),
    }));
  };

  return (
    <main className="now-page" data-testid="now-page">
      <header className="now-header">
        <button
          type="button"
          className="now-icon-button"
          onClick={handleBack}
          aria-label={mobileShell ? '返回过去' : '返回'}
        >
          <ArrowLeft size={20} />
        </button>
        <time className="now-time" dateTime={draft.record_time}>
          {draft.display_time}
        </time>
        <button
          type="button"
          className="now-assist-button now-assist-button--perched"
          onClick={() => onRouteChange('avatar-chat')}
          aria-label="分身记录"
        >
          <Bot size={25} />
        </button>
      </header>

      <div className="now-card">
        <section className="now-editor">
          <div className="now-editor__surface">
            <label htmlFor="now-record-text" className="sr-only">
              此刻发生了什么？
            </label>
            <textarea
              id="now-record-text"
              value={draft.text}
              maxLength={CONFIG.MAX_TEXT_LENGTH}
              onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
              placeholder="写下此刻"
              aria-describedby="now-record-count"
            />
            <div className="now-editor__meta">
              <span id="now-record-count" aria-live="polite">
                {draft.text.length}/{CONFIG.MAX_TEXT_LENGTH}
              </span>
            </div>
          </div>
          <MaterialPreview materials={draft.materials} onRemove={removeMaterial} />
        </section>

        <div className="now-actions">
          <div className="now-tool-row">
            <button
              type="button"
              className="now-anchor-point"
              onClick={() => onRouteChange('tags')}
              aria-label="心情与事件"
            >
              <span className={`now-anchor-point__icon ${canSend ? 'is-complete' : ''}`} aria-hidden="true">
                {canSend ? <Check size={16} /> : <Anchor size={20} />}
              </span>
              <span className="now-anchor-point__meta">
                <span className="now-anchor-point__count">{tagProgress}/2</span>
                {tagSummary ? <span className="now-anchor-point__summary">{tagSummary}</span> : null}
              </span>
            </button>
            <button
              type="button"
              className={`now-tool-button now-tool-button--add ${materialMenuOpen ? 'is-open' : ''}`}
              aria-label={materialMenuOpen ? '收起素材' : '添加素材'}
              aria-expanded={materialMenuOpen}
              onClick={() => setMaterialMenuOpen((open) => !open)}
            >
              <Plus size={21} />
            </button>
          </div>
          {materialMenuOpen ? (
            <div className="now-material-popover" aria-label="素材类型">
              <button type="button" className="now-tool-button" aria-label="图片" onClick={handleImageImport}>
                <Image size={19} />
              </button>
              <button type="button" className="now-tool-button" aria-label="视频" onClick={handleVideoImport}>
                <Video size={19} />
              </button>
              <button type="button" className="now-tool-button" aria-label="链接" onClick={handleLinkImport}>
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
            aria-label="发送过去"
            disabled={sending}
          >
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </footer>
      </div>
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

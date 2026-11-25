import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { NowDraft } from '../types/now';
import { AvatarModelSettings } from './AvatarModelSettings';
import { AvatarReliabilityAssistant } from './AvatarReliabilityAssistant';
import { useAvatarLanguage } from './avatarLanguage';

/** Data and model operations live outside the conversation and memory workspace. */
export function AvatarDataModelCenter({
  draft,
  onBack,
  onOpenDraft,
  showToast,
}: {
  draft: NowDraft;
  onBack: () => void;
  onOpenDraft: () => void;
  showToast: (message: string) => void;
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const { t } = useAvatarLanguage();
  return (
    <main className="now-page avatar-data-model-center" data-testid="avatar-data-model-center">
      <header className="avatar-page-controls">
        <button type="button" className="now-icon-button" onClick={onBack} aria-label={t('返回分身', 'Back to companion')}>
          <ArrowLeft size={20} />
        </button>
        <h1>{t('数据与模型中心', 'Data and model center')}</h1>
      </header>
      <section className="avatar-backup-workspace" aria-label={t('模型配置', 'Model connection')}>
        <h2>{t('模型配置', 'Model connection')}</h2>
        <p>{t('模型请求会发送至当前配置的服务商；已发送的数据无法撤回。API Key 的本机保存和会话保存范围以设置时的选择为准。', 'Requests go to the selected provider. Already sent data cannot be retracted. Choose whether the API key remains on this device or only for this session.')}</p>
        <button type="button" onClick={() => setModelOpen(true)}>{t('配置模型', 'Configure model')}</button>
      </section>
      <section className="avatar-backup-workspace" aria-label={t('备份与恢复', 'Backup and restore')}>
        <AvatarReliabilityAssistant task="backup" draft={draft} onOpenDraft={onOpenDraft} showToast={showToast} />
      </section>
      {modelOpen && <AvatarModelSettings onClose={() => setModelOpen(false)} onSaved={() => showToast(t('模型配置已更新', 'Model settings updated'))} />}
    </main>
  );
}

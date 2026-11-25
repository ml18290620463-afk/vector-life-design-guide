import React from 'react';
import { useAvatarLanguage } from './avatarLanguage';

export type ArtifactStatus = 'draft' | 'active' | 'history' | 'disabled';

/** Shared confirmation boundary for records, insights, memories and future drafts. */
export function UnifiedArtifactCard({
  kind,
  status = 'draft',
  children,
  actions,
  className = '',
}: {
  kind: 'record' | 'insight' | 'memory' | 'revision' | 'future';
  status?: ArtifactStatus;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const { t } = useAvatarLanguage();
  const labels = {
    draft: t('草稿', 'Draft'),
    active: t('已生效', 'Active'),
    history: t('历史版本', 'History'),
    disabled: t('已停用', 'Disabled'),
  };
  return (
    <article className={`unified-artifact-card ${className}`} data-artifact-kind={kind}>
      <span className="unified-artifact-card__status" data-artifact-status={status}>
        {labels[status]}
      </span>
      {children}
      {status === 'draft' && (
        <p className="unified-artifact-card__boundary">
          {t('对话回复不会自动保存；请明确确认后再写入。', 'Chat replies are not saved automatically. Confirm to save.')}
        </p>
      )}
      {actions}
    </article>
  );
}

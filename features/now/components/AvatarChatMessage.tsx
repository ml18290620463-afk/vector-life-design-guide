import React from 'react';
import type { DiaryEntry } from '../../../types';
import type { AvatarLaunchContext } from '../../avatar/types';
import type { ChatMessage, RecordPreviewPayload } from '../types/now';
import { formatAvatarReply } from '../state/avatarReplyFormat';
import { RecordPreviewCard } from './AvatarRecordPanels';
import { canAIReadEntry } from '../../../services/aiPrivacy';
import { useAvatarLanguage } from './avatarLanguage';
import { AvatarGrowthDraftCard } from './AvatarGrowthDraftCard';

export const AvatarChatMessage = React.memo(function AvatarChatMessage({
  message,
  pastEntries,
  preview,
  sending,
  launchContext,
  onSelectEntry,
  onSetPreview,
  onEditTags,
  onSendPreview,
  onOpenFuture,
}: {
  message: ChatMessage;
  pastEntries?: DiaryEntry[];
  preview: RecordPreviewPayload | null;
  sending: boolean;
  launchContext: AvatarLaunchContext;
  onSelectEntry?: (entryId: string) => void;
  onSetPreview: (payload: RecordPreviewPayload | null) => void;
  onEditTags: () => void;
  onSendPreview: (payload: RecordPreviewPayload) => void;
  onOpenFuture?: () => void;
}) {
  const { language, t } = useAvatarLanguage();
  if (message.type === 'record_preview' && message.payload) {
    const payload = preview ?? message.payload;
    return (
      <RecordPreviewCard
        payload={payload}
        sending={sending}
        onChange={onSetPreview}
        showPrincipleOutcome={launchContext.mode === 'review'}
        onEditTags={onEditTags}
        onSend={() => onSendPreview(payload)}
      />
    );
  }
  return (
    <div className={`now-chat-bubble ${message.role === 'user' ? 'is-user' : ''}`}>
      <div>
        {message.role === 'assistant' ? formatAvatarReply(message.content) : message.content}
      </div>
      {message.role === 'assistant' && launchContext.mode === 'review' && message.modelAssistance && (
        <AvatarGrowthDraftCard suggestion={message.content} onOpenFuture={onOpenFuture} />
      )}
      {message.role === 'assistant' && message.modelAssistance?.manifest && (
        <details className="avatar-message-references">
          <summary>
            {t('参考依据', 'Reference basis')} · {message.modelAssistance.manifest.matchedCount}
          </summary>
          <p>
            {t('关于我', 'About me')} {message.modelAssistance.manifest.breakdown.aboutMeCount} ·{' '}
            {t('我的认识', 'My understanding')}{' '}
            {message.modelAssistance.manifest.breakdown.understandingCount} ·{' '}
            {t('原始记录', 'Original records')}{' '}
            {message.modelAssistance.manifest.breakdown.rawRecordCount}
          </p>
          <p>
            {t('检索标签', 'Searched tags')}:{' '}
            {message.modelAssistance.manifest.searchedTags.join(' / ') || t('全部标签', 'All tags')}
          </p>
          <p>
            {t('时间范围', 'Time range')}:{' '}
            {message.modelAssistance.manifest.searchedTimeRange
              ? `${message.modelAssistance.manifest.searchedTimeRange.from} – ${message.modelAssistance.manifest.searchedTimeRange.to}`
              : t('可访问资料的全部时间', 'All accessible dates')}
          </p>
          {message.modelAssistance.manifest.scopeTier === 'local_deterministic' && (
            <p>
              {t(
                '本地确定性处理 · 未向模型发送资料',
                'Processed locally · No data sent to a model',
              )}
            </p>
          )}
          {message.modelAssistance.manifest.scopeTier !== 'local_deterministic' &&
            message.modelAssistance.manifest.matchedCount === 0 && (
              <p>
                {t(
                  '已搜索上述资料范围，未找到匹配记录',
                  'No matching records in the searched scope',
                )}
              </p>
            )}
        </details>
      )}
      {message.role === 'assistant' && message.references?.length ? (
        <details className="avatar-message-references">
          <summary>
            {t('查看经历', 'View sources')} ({message.references.length})
          </summary>
          <ul>
            {message.references.map((reference, index) => {
              const entry = pastEntries?.find(
                (item) => item.id === reference.entryId && canAIReadEntry(item),
              );
              return (
                <li key={`${reference.entryId}:${index}`}>
                  {entry ? (
                    <>
                      <button
                        type="button"
                        disabled={!onSelectEntry}
                        onClick={() => onSelectEntry?.(entry.id)}
                      >
                        {entry.title || t('未命名记录', 'Untitled record')}
                      </button>
                      <time>
                        {new Date(entry.createdAt).toLocaleDateString(
                          language === 'en' ? 'en-US' : 'zh-CN',
                        )}
                      </time>
                      <p>{entry.content}</p>
                      {entry.supplements
                        ?.filter(
                          (supplement) =>
                            !supplement.isEncrypted && supplement.createdAt <= Date.now(),
                        )
                        .map((supplement) => (
                          <div key={supplement.id}>
                            <small>{t('补充', 'Supplement')}</small>
                            <p>{supplement.content}</p>
                          </div>
                        ))}
                    </>
                  ) : (
                    <p>
                      {t('来源已删除、锁定或不可访问', 'Source deleted, locked, or unavailable')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
});

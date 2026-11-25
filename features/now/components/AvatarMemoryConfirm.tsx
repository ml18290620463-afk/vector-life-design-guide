import { SilkButton } from '../../../components/silk/SilkButton';
import { useAvatarLanguage } from './avatarLanguage';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type {
  AvatarMemoryNature,
  AvatarMemoryCategory,
  AvatarMemoryFacet,
  AvatarMemorySourceRef,
} from '../../avatar/types';
import { categoryForMemory } from '../../../services/avatarMemoryCategories';
import { isDirectionCandidate } from '../../../services/avatarMemoryCategories';
import { UnifiedArtifactCard } from './UnifiedArtifactCard';

export function AvatarMemoryConfirm({
  text,
  nature,
  tags,
  facets = [],
  candidateKind,
  categoryOverride,
  sourceCount = 0,
  sourceRefs = [],
  candidatePosition = 0,
  candidateTotal = 0,
  replacementStatement = null,
  onTextChange,
  onCancel,
  onConfirm,
  sending,
}: {
  text: string;
  nature: AvatarMemoryNature;
  tags: string[];
  facets?: AvatarMemoryFacet[];
  candidateKind?:
    | 'profile'
    | 'preference'
    | 'boundary'
    | 'value'
    | 'habit'
    | 'goal'
    | 'experience'
    | 'expression'
    | 'pattern_candidate'
    | null;
  categoryOverride?: AvatarMemoryCategory | null;
  sourceCount?: number;
  sourceRefs?: AvatarMemorySourceRef[];
  candidatePosition?: number;
  candidateTotal?: number;
  replacementStatement?: string | null;
  onTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: (
    tags: string[],
    category: AvatarMemoryCategory,
    nature: AvatarMemoryNature,
    directionKind?: 'vision' | 'goal' | 'action',
  ) => void;
  sending: boolean;
}) {
  const { language, t } = useAvatarLanguage();
  const [directionKind, setDirectionKind] = useState<'vision' | 'goal' | 'action'>('goal');
  const dialog = useRef<HTMLDialogElement>(null);
  const resolvedNature = nature;
  const category =
    categoryOverride ?? categoryForMemory({ nature: resolvedNature, statement: text, facets });
  const isDirection = isDirectionCandidate({ nature: resolvedNature, category, facets });
  const sourceSummary = (() => {
    const entryCount = sourceRefs.filter((source) => source.source === 'entry').length;
    const messageCount = sourceRefs.filter((source) => source.source === 'message').length;
    if (language === 'en')
      return `Based on ${entryCount} past record(s) and ${messageCount || sourceCount} chat statement(s). Only added to memory after your confirmation; this does not create a Past record.`;
    if (entryCount && messageCount)
      return `依据 ${entryCount} 条过往记录与 ${messageCount} 条聊天自述。确认后保存为分身记忆。`;
    if (entryCount) return `依据 ${entryCount} 条过往记录。确认后保存为分身记忆。`;
    if (messageCount)
      return `依据本次对话中的 ${messageCount} 条自述。确认后保存为分身记忆，不会写入过去经历。`;
    return `来源：聊天中的 ${sourceCount} 条自述。确认后才会加入记忆库。`;
  })();
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="avatar-memory-dialog"
      aria-labelledby="avatar-memory-confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!sending) onCancel();
      }}
    >
      <header className="avatar-memory-dialog__header">
        <button
          type="button"
          className="avatar-memory-dialog__back"
          aria-label={t('返回分身')}
          disabled={sending}
          onClick={onCancel}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <h2 id="avatar-memory-confirm-title">
          {replacementStatement
            ? t('更新这条关于你的理解？')
            : candidateKind === 'pattern_candidate'
              ? t('保留这条观察线索？')
              : t('记住这条关于你的信息？')}
        </h2>
      </header>
      <UnifiedArtifactCard kind={replacementStatement ? 'revision' : 'memory'} className="avatar-memory-dialog__artifact">
      {replacementStatement && (
        <div className="avatar-memory-dialog__context">
          <p className="avatar-memory-dialog__hint">{t('这会更新你已确认的理解：')}</p>
          <p>「{replacementStatement}」</p>
        </div>
      )}
      {candidateTotal > 1 && (
        <p className="avatar-memory-dialog__hint">
          {t('本段对话中的第', 'Candidate')} {candidatePosition + 1} / {candidateTotal}
        </p>
      )}
      <details className="avatar-memory-dialog__context">
        <summary>{t('提炼说明')}</summary>
        <p className="avatar-memory-dialog__hint">
          {sourceSummary}
          {candidateKind === 'pattern_candidate' && t(' 这是暂定观察，确认前不会影响分身记忆。')}
        </p>
      </details>
      <label htmlFor="avatar-memory-candidate">
        {facets.includes('preference')
          ? t('你的喜好')
          : facets.includes('boundary')
            ? t('你的边界')
            : facets.includes('habit')
              ? t('你的习惯')
              : facets.includes('value')
                ? t('你的价值取向')
                : candidateKind === 'goal'
                  ? t('你正在追求的方向')
                  : candidateKind === 'experience'
                    ? t('一段重要经历')
                    : candidateKind === 'expression'
                      ? t('你的表达偏好')
                      : candidateKind === 'pattern_candidate'
                        ? t('基于多次表达的观察')
                        : t('关于你')}
      </label>
      <textarea
        id="avatar-memory-candidate"
        aria-label={t('提炼的信息')}
        rows={3}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
      />
      {isDirection && (
        <label>
          {t('保存为')}
          <select
            aria-label={t('保存类型')}
            value={directionKind}
            onChange={(e) => setDirectionKind(e.target.value as typeof directionKind)}
          >
            <option value="vision">{t('愿景')}</option>
            <option value="goal">{t('目标')}</option>
            <option value="action">{t('行动')}</option>
          </select>
        </label>
      )}
      <div className="avatar-memory-dialog__actions">
        <button type="button" disabled={sending} onClick={onCancel}>
          {t('暂不记住')}
        </button>
        <SilkButton
          type="button"
          disabled={sending || !text.trim()}
          onClick={() =>
            onConfirm(tags, category, resolvedNature, isDirection ? directionKind : undefined)
          }
        >
          {replacementStatement
            ? t('确认更新')
            : candidateKind === 'pattern_candidate'
              ? t('保留观察')
              : t('确认记住')}
        </SilkButton>
      </div>
      </UnifiedArtifactCard>
    </dialog>
  );
}

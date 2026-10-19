import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type {
  AvatarMemoryNature,
  AvatarMemoryCategory,
  AvatarMemoryFacet,
  AvatarMemorySourceRef,
} from '../../avatar/types';
import { categoryForMemory } from '../../../services/avatarMemoryCategories';
import { isDirectionCandidate } from '../../../services/avatarMemoryArchive';

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
  const [directionKind, setDirectionKind] = useState<'vision' | 'goal' | 'action'>('goal');
  const dialog = useRef<HTMLDialogElement>(null);
  const resolvedNature = nature;
  const category =
    categoryOverride ?? categoryForMemory({ nature: resolvedNature, statement: text, facets });
  const isDirection = isDirectionCandidate({ nature: resolvedNature, category, facets });
  const sourceSummary = (() => {
    const entryCount = sourceRefs.filter((source) => source.source === 'entry').length;
    const messageCount = sourceRefs.filter((source) => source.source === 'message').length;
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
          aria-label="返回分身"
          disabled={sending}
          onClick={onCancel}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <h2 id="avatar-memory-confirm-title">
          {replacementStatement
            ? '更新这条关于你的理解？'
            : candidateKind === 'pattern_candidate'
              ? '保留这条观察线索？'
              : '记住这条关于你的信息？'}
        </h2>
      </header>
      {replacementStatement && (
        <div className="avatar-memory-dialog__context">
          <p className="avatar-memory-dialog__hint">这会更新你已确认的理解：</p>
          <p>「{replacementStatement}」</p>
        </div>
      )}
      {candidateTotal > 1 && (
        <p className="avatar-memory-dialog__hint">
          本段对话中的第 {candidatePosition + 1} / {candidateTotal} 条
        </p>
      )}
      <details className="avatar-memory-dialog__context">
        <summary>提炼说明</summary>
        <p className="avatar-memory-dialog__hint">
          {sourceSummary}
          {candidateKind === 'pattern_candidate' && ' 这是暂定观察，确认前不会影响分身记忆。'}
        </p>
      </details>
      <label htmlFor="avatar-memory-candidate">
        {facets.includes('preference')
          ? '你的喜好'
          : facets.includes('boundary')
            ? '你的边界'
            : facets.includes('habit')
              ? '你的习惯'
              : facets.includes('value')
                ? '你的价值取向'
                : candidateKind === 'goal'
                  ? '你正在追求的方向'
                  : candidateKind === 'experience'
                    ? '一段重要经历'
                    : candidateKind === 'expression'
                      ? '你的表达偏好'
                      : candidateKind === 'pattern_candidate'
                        ? '基于多次表达的观察'
                        : '关于你'}
      </label>
      <textarea
        id="avatar-memory-candidate"
        aria-label="提炼的信息"
        rows={3}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
      />
      {isDirection && (
        <label>
          保存为
          <select
            aria-label="保存类型"
            value={directionKind}
            onChange={(e) => setDirectionKind(e.target.value as typeof directionKind)}
          >
            <option value="vision">愿景</option>
            <option value="goal">目标</option>
            <option value="action">行动</option>
          </select>
        </label>
      )}
      <div className="avatar-memory-dialog__actions">
        <button type="button" disabled={sending} onClick={onCancel}>
          暂不记住
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={sending || !text.trim()}
          onClick={() =>
            onConfirm(tags, category, resolvedNature, isDirection ? directionKind : undefined)
          }
        >
          {replacementStatement
            ? '确认更新'
            : candidateKind === 'pattern_candidate'
              ? '保留观察'
              : '确认记住'}
        </button>
      </div>
    </dialog>
  );
}

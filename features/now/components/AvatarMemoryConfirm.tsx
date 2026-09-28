import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type {
  AvatarMemoryNature,
  AvatarMemoryCategory,
  AvatarMemoryFacet,
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
  candidateKind?: 'profile' | 'preference' | 'boundary' | 'value' | 'habit' | 'goal' | 'experience' | 'expression' | 'pattern_candidate' | null;
  categoryOverride?: AvatarMemoryCategory | null;
  sourceCount?: number;
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
  const category = categoryOverride ?? categoryForMemory({ nature: resolvedNature, statement: text, facets });
  const isDirection = isDirectionCandidate({ nature: resolvedNature, category, facets });
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
        <button type="button" className="avatar-memory-dialog__back" aria-label="返回分身" disabled={sending} onClick={onCancel}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <h2 id="avatar-memory-confirm-title">{replacementStatement ? '更新这条关于你的理解？' : candidateKind === 'pattern_candidate' ? '保留这条观察线索？' : '记住这条关于你的信息？'}</h2>
      </header>
      {replacementStatement && (
        <div className="avatar-memory-dialog__context">
          <p className="avatar-memory-dialog__hint">这会更新你已确认的理解：</p>
          <p>「{replacementStatement}」</p>
        </div>
      )}
      {candidateTotal > 1 && <p className="avatar-memory-dialog__hint">本段对话中的第 {candidatePosition + 1} / {candidateTotal} 条</p>}
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
      {candidateKind === 'pattern_candidate' && (
        <div className="avatar-memory-dialog__context">
          <p className="avatar-memory-dialog__hint">这是一个待验证的理解，不会把它当作既定事实。</p>
          {sourceCount > 0 && <p className="avatar-memory-dialog__hint">这段对话提供了 {sourceCount} 条线索；只有在不同时间或独立对话中持续出现，才会邀请你确认它。</p>}
        </div>
      )}
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
          {replacementStatement ? '确认更新' : '确认记住'}
        </button>
      </div>
    </dialog>
  );
}

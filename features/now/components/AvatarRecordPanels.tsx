import React, { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import type { AvatarUnderstandingStatus } from '../../avatar/types';
import type { AvatarRecallMemory, AvatarStructuredInsight } from '../state/nowRules';
import type { RecordPreviewPayload } from '../types/now';

export const AvatarRecallPanel: React.FC<{
  memories: AvatarRecallMemory[];
  onSelectEntry?: (entryId: string) => void;
}> = ({ memories, onSelectEntry }) => {
  const top = memories.slice(0, 2);
  return (
    <aside className="now-avatar-recall" aria-label="已找到">
      <div className="now-avatar-recall__head">
        <span>已找到</span>
        <strong>{memories.length}</strong>
      </div>
      {top.map((memory) => (
        <button
          key={memory.id}
          type="button"
          className="now-avatar-recall__item"
          onClick={() => onSelectEntry?.(memory.sourceEntryId)}
          disabled={!onSelectEntry}
          aria-label={`查看原始记录：${memory.title}`}
        >
          <span className="now-avatar-recall__title">{memory.title}</span>
          <time dateTime={new Date(memory.createdAt).toISOString()}>
            {new Date(memory.createdAt).toLocaleDateString('zh-CN')}
          </time>
          <span>{memory.excerpt}</span>
          <small>可查看来源</small>
        </button>
      ))}
    </aside>
  );
};

interface AvatarUnderstandingCardProps {
  statement: string;
  status?: AvatarUnderstandingStatus;
  onResolve: (status: 'confirmed' | 'rejected', statement: string) => void;
}

export const AvatarUnderstandingCard: React.FC<AvatarUnderstandingCardProps> = ({
  statement,
  status = 'pending',
  onResolve,
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(statement);
  const isPending = status === 'pending';
  return (
    <aside className="now-avatar-understanding" aria-label="理解">
      <div className="now-avatar-understanding__head">
        <strong>理解</strong>
        <span>{isPending ? '待确认' : status === 'confirmed' ? '已归纳' : '已忽略'}</span>
      </div>
      {editing && isPending ? (
        <textarea
          aria-label="修改理解"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      ) : (
        <p>{value}</p>
      )}
      {isPending && (
        <div className="now-avatar-understanding__actions">
          <button type="button" onClick={() => onResolve('confirmed', value.trim() || statement)}>
            <Check size={15} aria-hidden="true" />
            确认
          </button>
          <button type="button" onClick={() => setEditing((current) => !current)}>
            <Pencil size={15} aria-hidden="true" />
            {editing ? '继续确认' : '修改'}
          </button>
          <button type="button" onClick={() => onResolve('rejected', value.trim() || statement)}>
            <X size={15} aria-hidden="true" />
            忽略
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {status === 'confirmed' ? '已归纳' : status === 'rejected' ? '已忽略' : ''}
      </p>
    </aside>
  );
};

export const AvatarInsightPanel: React.FC<{
  insight: AvatarStructuredInsight;
  evidence?: AvatarRecallMemory[];
  onSelectEntry?: (entryId: string) => void;
}> = ({ insight, evidence = [], onSelectEntry }) => {
  const rows = [
    ['事实', insight.fact],
    ['行动', insight.action],
    ['感受', insight.feeling],
    ['想法', insight.thought],
    ['结果', insight.result],
  ].filter(([, value]) => Boolean(value));
  const tags = [...insight.moodTags, ...insight.eventTags];
  return (
    <aside className="now-avatar-insight" aria-label="已识别">
      <div className="now-avatar-insight__head">
        <span>已识别</span>
        <strong>{insight.completeness}%</strong>
      </div>
      <div className="now-avatar-insight__evidence" aria-label="洞察依据">
        {insight.evidenceEntryIds.length > 0 ? (
          <>
            <span>{insight.evidenceEntryIds.length} 条来源</span>
            {evidence
              .filter((memory) => insight.evidenceEntryIds.includes(memory.sourceEntryId))
              .slice(0, 2)
              .map((memory) => (
                <button
                  key={memory.sourceEntryId}
                  type="button"
                  onClick={() => onSelectEntry?.(memory.sourceEntryId)}
                  disabled={!onSelectEntry}
                >
                  {memory.title}
                </button>
              ))}
          </>
        ) : (
          <span>等待来源</span>
        )}
      </div>
      {rows.length > 0 ? (
        <div className="now-avatar-insight__rows">
          {rows.map(([label, value]) => (
            <p key={label}>
              <span>{label}</span>
              {value}
            </p>
          ))}
        </div>
      ) : (
        <p className="now-avatar-insight__empty">继续输入</p>
      )}
      {tags.length > 0 && (
        <div className="now-avatar-insight__tags">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}
    </aside>
  );
};

interface RecordPreviewCardProps {
  payload: RecordPreviewPayload;
  sending: boolean;
  onChange: (payload: RecordPreviewPayload) => void;
  onEditTags: () => void;
  onSend: () => void;
  showPrincipleOutcome?: boolean;
}

export const RecordPreviewCard: React.FC<RecordPreviewCardProps> = ({
  payload,
  sending,
  onChange,
  onEditTags,
  onSend,
  showPrincipleOutcome = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(payload.text);
  return (
    <article className="now-preview-card">
      {editing ? (
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      ) : (
        <p>{text}</p>
      )}
      <div className="now-preview-tags">
        {[
          ...payload.mood_tags.map((tag) => `心情·${tag}`),
          ...payload.event_tags.map((tag) => `事件·${tag}`),
        ].join('  ')}
      </div>
      {showPrincipleOutcome && (
        <fieldset className="now-preview-outcome">
          <legend>行动结果</legend>
          <div role="group" aria-label="评价行动所用原则">
            {[
              ['helpful', '有效'],
              ['partial', '部分有效'],
              ['unhelpful', '无效'],
            ].map(([outcome, label]) => (
              <button
                key={outcome}
                type="button"
                aria-pressed={payload.principle_outcome === outcome}
                onClick={() =>
                  onChange({
                    ...payload,
                    principle_outcome: outcome as NonNullable<
                      RecordPreviewPayload['principle_outcome']
                    >,
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="now-preview-actions">
        <button
          type="button"
          onClick={() => {
            if (editing) onChange({ ...payload, text });
            setEditing((value) => !value);
          }}
        >
          {editing ? '保存' : '修改'}
        </button>
        <button type="button" onClick={onEditTags}>
          改标签
        </button>
        <button type="button" onClick={onSend} disabled={sending}>
          保存到过去
        </button>
      </div>
    </article>
  );
};

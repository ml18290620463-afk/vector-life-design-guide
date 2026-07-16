import React, { useState } from 'react';
import type { AvatarRecallMemory, AvatarStructuredInsight } from '../state/nowRules';
import type { RecordPreviewPayload } from '../types/now';

export const AvatarRecallPanel: React.FC<{ memories: AvatarRecallMemory[] }> = ({ memories }) => {
  const top = memories.slice(0, 2);
  return (
    <aside className="now-avatar-recall" aria-label="关联过去">
      <div className="now-avatar-recall__head">
        <span>关联过去</span>
        <strong>{memories.length}</strong>
      </div>
      {top.map((memory) => (
        <p key={memory.id}>
          <span>{memory.title}</span>
          {memory.excerpt}
        </p>
      ))}
    </aside>
  );
};

export const AvatarInsightPanel: React.FC<{ insight: AvatarStructuredInsight }> = ({ insight }) => {
  const rows = [
    ['事实', insight.fact],
    ['行动', insight.action],
    ['感受', insight.feeling],
    ['想法', insight.thought],
    ['结果', insight.result],
  ].filter(([, value]) => Boolean(value));
  const tags = [...insight.moodTags, ...insight.eventTags];
  return (
    <aside className="now-avatar-insight" aria-label="实时提炼">
      <div className="now-avatar-insight__head">
        <span>实时提炼</span>
        <strong>{insight.completeness}%</strong>
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
        <p className="now-avatar-insight__empty">继续说，我会自动抓取记录重点。</p>
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
}

export const RecordPreviewCard: React.FC<RecordPreviewCardProps> = ({
  payload,
  sending,
  onChange,
  onEditTags,
  onSend,
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
          发送过去
        </button>
      </div>
    </article>
  );
};

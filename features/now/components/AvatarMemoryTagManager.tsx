import React, { useMemo, useState } from 'react';
import type { AvatarAtomicMemory } from '../../avatar/types';
import {
  archiveAvatarMemoryTag,
  buildAvatarMemoryTagOverview,
  mergeAvatarMemoryTags,
  renameAvatarMemoryTag,
  restoreAvatarMemoryTag,
  updateAvatarMemoryTags,
} from '../../../services/avatarMemory';

interface AvatarMemoryTagManagerProps {
  memories: AvatarAtomicMemory[];
  onRefresh: () => void;
  showToast: (message: string) => void;
}

const splitTags = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/[、,，\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 16);

const formatDate = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toLocaleDateString('zh-CN') : '时间未知';

const natureLabel: Record<AvatarAtomicMemory['nature'], string> = {
  experience: '经历',
  explicit: '明确表达',
  inferred: '推断',
  commitment: '承诺',
  state: '状态',
};

const statusLabel: Record<AvatarAtomicMemory['status'], string> = {
  candidate: '候选',
  confirmed: '已确认',
  superseded: '已替代',
  rejected: '已拒绝',
  retained: '已保留',
};

export const AvatarMemoryTagManager: React.FC<AvatarMemoryTagManagerProps> = ({
  memories,
  onRefresh,
  showToast,
}) => {
  const [selectedTag, setSelectedTag] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  const tagOverview = useMemo(() => buildAvatarMemoryTagOverview(memories), [memories]);
  const visibleTags = tagOverview.filter((tag) => showArchived || tag.status !== 'archived');
  const activeSelectedTag =
    selectedTag && tagOverview.some((tag) => tag.name === selectedTag)
      ? selectedTag
      : (visibleTags[0]?.name ?? '');
  const selectedTagMeta = tagOverview.find((tag) => tag.name === activeSelectedTag);
  const taggedMemories = activeSelectedTag
    ? memories.filter((memory) => memory.tags.includes(activeSelectedTag))
    : [];

  const refreshAfter = (message: string) => {
    onRefresh();
    showToast(message);
  };

  const handleRename = () => {
    if (!activeSelectedTag || !renameValue.trim()) {
      showToast('请输入新的标签名');
      return;
    }
    if (renameAvatarMemoryTag(activeSelectedTag, renameValue)) {
      setSelectedTag(renameValue.trim());
      setRenameValue('');
      refreshAfter('标签已重命名');
    } else {
      showToast('重命名失败，请检查标签名');
    }
  };

  const handleMerge = () => {
    if (!activeSelectedTag || !mergeTarget.trim()) {
      showToast('请输入要合并到的目标标签');
      return;
    }
    if (mergeAvatarMemoryTags([activeSelectedTag], mergeTarget)) {
      setSelectedTag(mergeTarget.trim());
      setMergeTarget('');
      refreshAfter('标签已合并');
    } else {
      showToast('合并失败，请检查目标标签');
    }
  };

  const handleArchiveToggle = () => {
    if (!activeSelectedTag) return;
    const saved =
      selectedTagMeta?.status === 'archived'
        ? restoreAvatarMemoryTag(activeSelectedTag)
        : archiveAvatarMemoryTag(activeSelectedTag);
    if (saved) {
      refreshAfter(selectedTagMeta?.status === 'archived' ? '标签已恢复' : '标签已归档');
    } else {
      showToast('操作失败，请重试');
    }
  };

  const startEditMemory = (memory: AvatarAtomicMemory) => {
    setEditingMemoryId(memory.id);
    setTagDraft(memory.tags.join('、'));
  };

  const saveMemoryTags = (memoryId: string) => {
    const updated = updateAvatarMemoryTags(memoryId, splitTags(tagDraft));
    if (!updated) {
      showToast('记忆标签保存失败');
      return;
    }
    setEditingMemoryId(null);
    setTagDraft('');
    refreshAfter('记忆标签已更新');
  };

  return (
    <section className="avatar-memory-tags" aria-label="记忆标签管理">
      <div className="avatar-memory-tags__header">
        <div>
          <span>记忆标签</span>
        </div>
        <label className="avatar-memory-tags__toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          显示归档
        </label>
      </div>

      {tagOverview.length === 0 ? (
        <div className="avatar-memory-tags__empty">暂无标签</div>
      ) : (
        <>
          <div className="avatar-memory-tags__chips" role="list" aria-label="标签列表">
            {visibleTags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                aria-label={`${tag.name}，${tag.memoryCount} 条记忆`}
                className={`avatar-memory-tags__chip ${tag.name === activeSelectedTag ? 'is-active' : ''} ${tag.status === 'archived' ? 'is-archived' : ''}`}
                onClick={() => setSelectedTag(tag.name)}
                aria-pressed={tag.name === activeSelectedTag}
              >
                <span>{tag.name}</span>
                <small>{tag.memoryCount}</small>
              </button>
            ))}
          </div>

          {activeSelectedTag && (
            <div className="avatar-memory-tags__panel">
              <div className="avatar-memory-tags__selected">
                <div>
                  <span>{activeSelectedTag}</span>
                  <small>
                    {taggedMemories.length} 条记忆 ·{' '}
                    {selectedTagMeta?.status === 'archived' ? '已归档' : '使用中'}
                  </small>
                  {selectedTagMeta?.aliases.length ? (
                    <small>别名：{selectedTagMeta.aliases.join('、')}</small>
                  ) : null}
                </div>
                <button type="button" onClick={handleArchiveToggle}>
                  {selectedTagMeta?.status === 'archived' ? '恢复标签' : '归档标签'}
                </button>
              </div>

              <div className="avatar-memory-tags__actions">
                <label>
                  重命名
                  <input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    placeholder="新的标签名"
                  />
                </label>
                <button type="button" onClick={handleRename}>
                  重命名
                </button>
                <label>
                  合并到
                  <input
                    value={mergeTarget}
                    onChange={(event) => setMergeTarget(event.target.value)}
                    placeholder="目标标签"
                  />
                </label>
                <button type="button" onClick={handleMerge}>
                  合并
                </button>
              </div>

              <div className="avatar-memory-tags__memories" aria-label="标签下的记忆">
                {taggedMemories.map((memory) => (
                  <article key={memory.id} className="avatar-memory-tags__memory">
                    <p>{memory.statement}</p>
                    <small>
                      {natureLabel[memory.nature]} · {statusLabel[memory.status]} · 来源{' '}
                      {memory.sourceRefs.length} ·{' '}
                      {formatDate(memory.updatedAt ?? memory.createdAt)}
                    </small>
                    {editingMemoryId === memory.id ? (
                      <div className="avatar-memory-tags__edit-row">
                        <input
                          aria-label="编辑记忆标签"
                          value={tagDraft}
                          onChange={(event) => setTagDraft(event.target.value)}
                          placeholder="用逗号、顿号或空格分隔"
                        />
                        <button type="button" onClick={() => saveMemoryTags(memory.id)}>
                          保存
                        </button>
                        <button type="button" onClick={() => setEditingMemoryId(null)}>
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="avatar-memory-tags__memory-tags">
                        {memory.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                        <button type="button" onClick={() => startEditMemory(memory)}>
                          编辑标签
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

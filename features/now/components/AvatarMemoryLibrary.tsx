import { saveArchiveDirection } from '../../../services/futureRepository';
import { isPatternMemoryReadyForConfirmation } from '../../../services/avatarMemory';
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AvatarAtomicMemory, AvatarUnderstandingVersion } from '../../avatar/types';
import {
  selfCategoriesForMemory,
  type SelfCategory,
  archiveScopeForMemory,
  archiveChanges,
  saveArchiveMemory,
  supersedeArchiveMemory,
} from '../../../services/avatarMemoryArchive';
import { isCanonicalAvatarProjection } from '../../../services/avatarKnowledgeProjection';
import { AvatarMemoryDetail } from './AvatarMemoryDetail';

type ArchiveScope = 'self' | 'pattern' | 'changes';
type PatternDimension = 'understanding' | 'choice' | 'action_relation';
type Dimension = SelfCategory | PatternDimension | 'updates';

const SELF_DIMENSIONS = [
  { id: 'profile' as const, label: '基础与处境', description: '我当前的角色、背景与重要关系' },
  {
    id: 'value_motivation' as const,
    label: '价值与动力',
    description: '我在意什么，什么值得我投入',
  },
  {
    id: 'preference_boundary' as const,
    label: '偏好与边界',
    description: '什么方式适合我，什么代价不接受',
  },
  {
    id: 'ability_condition' as const,
    label: '能力与条件',
    description: '我已有的能力、资源与当前限制',
  },
];

const PATTERN_DIMENSIONS = [
  {
    id: 'understanding' as const,
    label: '理解与判断',
    description: '我怎样理解事情，通常依据什么判断',
  },
  { id: 'choice' as const, label: '选择与取舍', description: '面对冲突时，我往往优先保住什么' },
  {
    id: 'action_relation' as const,
    label: '行动与关系',
    description: '我在行动、情绪与关系中的常见倾向',
  },
];

function matchesPatternDimension(memory: AvatarAtomicMemory, dimension: PatternDimension) {
  const facets = memory.facets;
  if (dimension === 'understanding')
    return facets.includes('cognitive_pattern') || facets.length === 0;
  if (dimension === 'choice')
    return facets.includes('behavioral_pattern') || facets.includes('habit');
  return facets.some((facet) =>
    ['emotional_pattern', 'relational_pattern', 'emotional_trigger'].includes(facet),
  );
}

export function AvatarMemoryLibrary({
  memories,
  pendingMemories = [],
  historyMemories = [],
  patterns = [],
  onRefresh,
  showToast,
  onAdd,
}: {
  memories: AvatarAtomicMemory[];
  pendingMemories?: AvatarAtomicMemory[];
  historyMemories?: AvatarAtomicMemory[];
  patterns?: AvatarUnderstandingVersion[];
  onRefresh: () => void;
  showToast: (message: string) => void;
  onAdd: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [converted, setConverted] = useState<string[]>([]);
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>('self');
  const [selectedDimension, setSelectedDimension] = useState<Dimension | null>(null);
  const [query, setQuery] = useState('');
  const [pendingOpen, setPendingOpen] = useState(false);
  const [selected, setSelected] = useState<AvatarAtomicMemory | null>(null);
  const allMemories = [
    ...new Map([...memories, ...pendingMemories].map((memory) => [memory.id, memory])).values(),
  ].filter(
    (memory) =>
      !converted.includes(memory.id) &&
      ['candidate', 'confirmed', 'retained'].includes(memory.status),
  );
  const pending = allMemories.filter(
    (memory) =>
      memory.status === 'candidate' &&
      (!memory.facets.includes('cognitive_pattern') || isPatternMemoryReadyForConfirmation(memory)),
  );
  const showingPending = pendingOpen && pending.length > 0;
  const matchesQuery = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  const changes = archiveChanges(historyMemories, patterns).filter((change) =>
    matchesQuery(`${change.before} ${change.after}`),
  );
  const isDetail = selectedDimension !== null;
  const searching = query.trim().length > 0;
  const visible = allMemories
    .filter((memory) => {
      if (!matchesQuery(`${memory.statement} ${memory.tags.join(' ')}`)) return false;
      if (showingPending) return memory.status === 'candidate';
      if (memory.status === 'candidate') return false;
      if (archiveScopeForMemory(memory) !== archiveScope) return false;
      if (archiveScope === 'self')
        return selectedDimension
          ? selfCategoriesForMemory(memory).includes(selectedDimension as SelfCategory)
          : searching;
      if (archiveScope === 'pattern')
        return selectedDimension
          ? matchesPatternDimension(memory, selectedDimension as PatternDimension)
          : searching;
      return false;
    })
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  const preview = (scope: ArchiveScope, dimension: Dimension, fallback: string) => {
    const memory = allMemories
      .filter(
        (item) =>
          item.status !== 'candidate' &&
          archiveScopeForMemory(item) === scope &&
          (scope === 'self'
            ? selfCategoriesForMemory(item).includes(dimension as SelfCategory)
            : matchesPatternDimension(item, dimension as PatternDimension)),
      )
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))[0];
    return memory?.statement ?? fallback;
  };
  const countSelf = (category: SelfCategory) =>
    allMemories.filter(
      (memory) =>
        memory.status !== 'candidate' &&
        archiveScopeForMemory(memory) === 'self' &&
        selfCategoriesForMemory(memory).includes(category),
    ).length;
  const countPattern = (dimension: PatternDimension) =>
    allMemories.filter(
      (memory) =>
        memory.status !== 'candidate' &&
        archiveScopeForMemory(memory) === 'pattern' &&
        matchesPatternDimension(memory, dimension),
    ).length;
  const changeScope = (scope: ArchiveScope) => {
    setArchiveScope(scope);
    setSelectedDimension(null);
    setPendingOpen(false);
    setQuery('');
  };
  const openDimension = (dimension: Dimension) => {
    setSelectedDimension(dimension);
    setPendingOpen(false);
    setQuery('');
  };
  const save = async (
    statement: string,
    status: 'confirmed' | 'rejected',
    kind?: 'vision' | 'goal' | 'action',
  ) => {
    if (!selected || saving) return;
    try {
      if (status === 'confirmed' && kind) {
        setSaving(true);
        await saveArchiveDirection({
          proposalId: selected.id,
          kind,
          text: statement,
          tags: selected.tags,
          sourceRefs: selected.sourceRefs,
        });
        setConverted((ids) => [...ids, selected.id]);
      } else if (!saveArchiveMemory(selected, statement, status)) throw new Error('save failed');
      setSelected(null);
      onRefresh();
      showToast(
        status === 'confirmed'
          ? '记忆已更新'
          : selected.status === 'candidate'
            ? '已忽略'
            : '已忘记',
      );
    } catch {
      showToast('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };
  const supersede = (statement: string) => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      if (!supersedeArchiveMemory(selected, statement)) throw new Error('save failed');
      setSelected(null);
      onRefresh();
      showToast(
        selected.id.startsWith('atomic_pattern_')
          ? '已更新模式，旧表述已归入我的变化'
          : '已更新记忆，旧表述已归入我的变化',
      );
    } catch {
      showToast('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };
  const detailTitle =
    archiveScope === 'changes'
      ? '认识更新'
      : archiveScope === 'self'
        ? SELF_DIMENSIONS.find((item) => item.id === selectedDimension)?.label
        : PATTERN_DIMENSIONS.find((item) => item.id === selectedDimension)?.label;
  return (
    <section className="avatar-library" aria-label="记忆档案">
      {!showingPending && (
        <nav className="avatar-self-categories avatar-library__scopes" aria-label="记忆档案范围">
          {(
            [
              { id: 'self', label: '关于我' },
              { id: 'pattern', label: '我的模式' },
              { id: 'changes', label: '我的变化' },
            ] as const
          ).map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={archiveScope === item.id}
              onClick={() => changeScope(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      <div className="avatar-library__toolbar">
        <input
          type="search"
          aria-label="搜索记忆"
          placeholder="搜索当前分类"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {archiveScope !== 'changes' && !showingPending && (
          <button type="button" onClick={onAdd}>
            新增记忆
          </button>
        )}
      </div>
      {pending.length > 0 && (
        <button
          type="button"
          className="avatar-library__pending"
          aria-pressed={showingPending}
          onClick={() => {
            setPendingOpen(!showingPending);
            setSelectedDimension(null);
          }}
        >
          {showingPending ? '返回档案' : `待确认 · ${pending.length}`}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
      {!showingPending && !isDetail && !searching && archiveScope === 'self' && (
        <div className="avatar-library__dimension-grid" aria-label="关于我的内部维度">
          {SELF_DIMENSIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="avatar-library__dimension-card"
              onClick={() => openDimension(item.id)}
            >
              <span className="avatar-library__dimension-card-title">
                {item.label}
                <small>{countSelf(item.id)} 条</small>
              </span>
              <span className="avatar-library__dimension-card-description">
                {preview(archiveScope, item.id, item.description)}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {!showingPending && !isDetail && !searching && archiveScope === 'pattern' && (
        <div className="avatar-library__dimension-grid" aria-label="我的模式的内部维度">
          {PATTERN_DIMENSIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="avatar-library__dimension-card"
              onClick={() => openDimension(item.id)}
            >
              <span className="avatar-library__dimension-card-title">
                {item.label}
                <small>{countPattern(item.id)} 条</small>
              </span>
              <span className="avatar-library__dimension-card-description">
                {preview(archiveScope, item.id, item.description)}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {!showingPending && !isDetail && !searching && archiveScope === 'changes' && (
        <div
          className="avatar-library__dimension-grid avatar-library__dimension-grid--single"
          aria-label="我的变化的内部维度"
        >
          <button
            type="button"
            className="avatar-library__dimension-card"
            onClick={() => openDimension('updates')}
          >
            <span className="avatar-library__dimension-card-title">
              认识更新<small>{changes.length} 条</small>
            </span>
            <span className="avatar-library__dimension-card-description">
              已确认认识在时间中的修正与更新
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      {(showingPending || isDetail || searching) && (
        <div className="avatar-library__detail-heading">
          {!showingPending && (
            <button
              type="button"
              className="avatar-library__back"
              onClick={() => {
                setSelectedDimension(null);
                setQuery('');
              }}
            >
              <ChevronLeft size={17} aria-hidden="true" />
              返回
            </button>
          )}
          <h2>{showingPending ? '待确认' : searching && !isDetail ? '搜索结果' : detailTitle}</h2>
        </div>
      )}
      {(showingPending || isDetail || searching) && (
        <div
          className="avatar-library__memories"
          aria-label={
            showingPending ? '待确认记忆' : archiveScope === 'changes' ? '认识更新' : '已确认记忆'
          }
        >
          {!showingPending &&
            archiveScope === 'changes' &&
            changes.map((change) => (
              <article className="avatar-library__change" key={change.id}>
                <small>调整于 {new Date(change.at).toLocaleDateString('zh-CN')}</small>
                <p>
                  <span>此前</span>
                  {change.before}
                </p>
                <p>
                  <span>现在</span>
                  {change.after}
                </p>
              </article>
            ))}
          {visible.length === 0 &&
            (archiveScope !== 'changes' || showingPending || changes.length === 0) && (
              <p className="avatar-library__empty">
                {query
                  ? '没有匹配的记忆'
                  : archiveScope === 'changes' && !showingPending
                    ? '暂无可对比的认识更新'
                    : archiveScope === 'pattern' && !showingPending
                      ? '暂无已确认模式'
                      : '暂无已确认记忆'}
              </p>
            )}
          {visible.map((memory) => (
            <button
              key={memory.id}
              type="button"
              className="avatar-library__row"
              onClick={() => setSelected(memory)}
            >
              <span className="avatar-library__row-content">
                <span>{memory.statement}</span>
                {memory.retainedAfterSourceDeletion ? (
                  <small className="avatar-library__retained">已保留 · 原始经历已删除</small>
                ) : null}
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {selected && (
        <AvatarMemoryDetail
          busy={saving}
          memory={selected}
          sources={memories}
          readOnly={
            isCanonicalAvatarProjection(selected) && !selected.id.startsWith('atomic_pattern_')
          }
          onClose={() => setSelected(null)}
          onSave={save}
          onSupersede={supersede}
        />
      )}
    </section>
  );
}

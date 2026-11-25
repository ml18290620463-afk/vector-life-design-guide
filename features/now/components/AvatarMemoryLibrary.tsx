import { useAvatarLanguage } from './avatarLanguage';
import { PrivateVisibilityIcon } from '../../../components/PrivateVisibilityIcon';
import { useAIVisibilityChoice } from '../../../components/AIVisibilityDialog';
import type { DiaryEntry } from '../../../types';
import { selfMemoryVoice } from '../../../services/avatarMemoryVoice';
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CognitiveObject } from '../../avatar/types';
import type { AvatarOntologySnapshot } from '../../../services/avatarOntologyStore';
import {
  archiveScope as archiveScopeForMemory,
  archiveTags,
  archiveRevisions,
  reviewArchiveCognition,
  reviewArchiveBatch,
} from '../../../services/avatarOntologyArchive';
import { AvatarMemoryDetail } from './AvatarMemoryDetail';
import { setAvatarGuardrailEnabled } from '../../../services/avatarGuardrail';

type SelfCategory = 'profile' | 'preference_boundary' | 'value_motivation' | 'ability_condition';
const selfCategoriesForMemory = (memory: CognitiveObject): SelfCategory[] => {
  const categories: Record<string, SelfCategory> = {
    foundation_situation: 'profile',
    preferences_boundaries: 'preference_boundary',
    values_motivation: 'value_motivation',
    capabilities_conditions: 'ability_condition',
  };
  return categories[memory.category] ? [categories[memory.category]] : [];
};
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

function matchesPatternDimension(memory: CognitiveObject, dimension: PatternDimension) {
  return (
    memory.category ===
    (
      {
        understanding: 'understanding_judgment',
        choice: 'choices_tradeoffs',
        action_relation: 'actions_relationships',
      } as const
    )[dimension]
  );
}

export function AvatarMemoryLibrary({
  graph,
  entries = [],
  onRefresh,
  showToast,
  onAdd,
  onRevise,
  onSelectEntry,
}: {
  graph: AvatarOntologySnapshot;
  entries?: DiaryEntry[];
  onRefresh: () => void;
  showToast: (message: string) => void;
  onAdd: () => void;
  onRevise: (memory: CognitiveObject, statement: string) => Promise<void>;
  onSelectEntry?: (entryId: string) => void;
}) {
  const { language, t } = useAvatarLanguage();
  const [reviewQueue, setReviewQueue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converted, setConverted] = useState<string[]>([]);
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>('self');
  const [selectedDimension, setSelectedDimension] = useState<Dimension | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [selected, setSelected] = useState<CognitiveObject | null>(null);
  const allMemories = graph.objects.filter(
    (memory) =>
      !converted.includes(memory.id) &&
      ['candidate', 'confirmed', 'retained_after_source_delete'].includes(memory.status),
  );
  const pending = allMemories.filter((memory) => memory.status === 'candidate');
  const showingPending = pendingOpen && pending.length > 0;
  const matchesQuery = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  const isDetail = selectedDimension !== null;
  const searching = query.trim().length > 0 || selectedTag !== null;
  const tags = [...new Set(allMemories.flatMap((memory) => archiveTags(graph, memory.id)))].sort();
  const visible = allMemories
    .filter((memory) => {
      if (
        !matchesQuery(
          `${selfMemoryVoice(memory.statement)} ${archiveTags(graph, memory.id).join(' ')}`,
        )
      )
        return false;
      if (selectedTag && !archiveTags(graph, memory.id).includes(selectedTag)) return false;
      if (showingPending) return pending.some((item) => item.id === memory.id);
      if (memory.status === 'candidate') return false;
      if (searching) return true;
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
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
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
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    return memory ? selfMemoryVoice(memory.statement) : fallback;
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
  };
  const openDimension = (dimension: Dimension) => {
    setSelectedDimension(dimension);
    setPendingOpen(false);
    setSelectedTag(null);
    setQuery('');
  };
  const changes = archiveRevisions(graph).filter(
    (change) =>
      matchesQuery(`${change.before} ${change.after}`) &&
      (!selectedTag ||
        [change.before, change.after].some((statement) =>
          allMemories.some(
            (memory) =>
              memory.statement === statement && archiveTags(graph, memory.id).includes(selectedTag),
          ),
        )),
  );
  const visibilityChoice = useAIVisibilityChoice(language, 'memory');
  const reviewAll = async (action: 'confirm' | 'ignore') => {
    if (saving || !pending.length) return;
    setSaving(true);
    try {
      const choice = action === 'confirm' ? await visibilityChoice.request() : 'private';
      if (!choice) return;
      await reviewArchiveBatch(graph, pending, action, choice === 'allowed');
      setConverted((ids) => [...ids, ...pending.map((item) => item.id)]);
      setSelected(null);
      setPendingOpen(false);
      onRefresh();
      showToast(action === 'confirm' ? t('记忆已更新') : t('已忽略'));
    } catch {
      showToast(t('保存失败，请重试', 'Save failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  };
  const saveMemory = async (
    memory: CognitiveObject,
    statement: string,
    status: 'confirmed' | 'rejected',
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      if (status === 'confirmed' && statement.trim() !== memory.statement.trim()) {
        await onRevise(memory, statement);
        setSelected(null);
        return;
      }
      const aiVisibility = status === 'confirmed' ? await visibilityChoice.request() : 'private';
      if (!aiVisibility) return;
      await reviewArchiveCognition(graph, memory, status, aiVisibility === 'allowed');
      if (memory.status === 'candidate') setConverted((ids) => [...ids, memory.id]);
      setSelected(reviewQueue ? (pending.find((item) => item.id !== memory.id) ?? null) : null);
      onRefresh();
      showToast(
        status === 'confirmed'
          ? t('记忆已更新')
          : memory.status === 'candidate'
            ? t('已忽略')
            : t('已忘记'),
      );
    } catch {
      showToast(t('保存失败，请重试', 'Save failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  };
  const supersede = async (statement: string) => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await onRevise(selected, statement);
      setSelected(null);
      onRefresh();
    } catch {
      showToast(t('保存失败，请重试', 'Save failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  };
  const toggleGuardrail = async (memory: CognitiveObject, enabled: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await setAvatarGuardrailEnabled(graph.revision, memory.id, enabled);
      setSelected(null);
      onRefresh();
      showToast(t(enabled ? '个人护栏已启用' : '个人护栏已关闭', enabled ? 'Personal reminder enabled' : 'Personal reminder disabled'));
    } catch {
      showToast(t('资料已更新，请刷新后重试', 'Data changed. Refresh and try again.'));
    } finally {
      setSaving(false);
    }
  };
  const detailTitle =
    archiveScope === 'self'
      ? SELF_DIMENSIONS.find((item) => item.id === selectedDimension)?.label
      : PATTERN_DIMENSIONS.find((item) => item.id === selectedDimension)?.label;
  return (
    <section className="avatar-library" aria-label={t('记忆库')}>
      {visibilityChoice.dialog}
      {!showingPending && (
        <nav className="avatar-self-categories avatar-library__scopes" aria-label={t('记忆库范围')}>
          {(
            [
              { id: 'self', label: t('关于我') },
              { id: 'pattern', label: t('我的认识') },
              { id: 'changes', label: t('我的变化') },
            ] as const
          ).map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={archiveScope === item.id}
              onClick={() => changeScope(item.id)}
            >
              {t(item.label)}
            </button>
          ))}
        </nav>
      )}
      <div className="avatar-library__toolbar">
        <input
          type="search"
          aria-label={t('搜索记忆')}
          placeholder={t('搜索整个记忆库', 'Search all memories')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {archiveScope !== 'changes' && !showingPending && (
          <button type="button" onClick={onAdd}>
            {t('新增记忆')}
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <div
          className="avatar-library__tags"
          aria-label={t('按记录标签筛选', 'Filter by record tag')}
        >
          <button
            type="button"
            aria-pressed={selectedTag === null}
            onClick={() => setSelectedTag(null)}
          >
            {t('全部标签', 'All tags')}
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={selectedTag === tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
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
          {showingPending ? t('返回记忆库') : `${t('待确认')} · ${pending.length}`}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
      {showingPending && (
        <div className="avatar-library__candidate-actions">
          <button type="button" disabled={saving} onClick={() => void reviewAll('ignore')}>
            {t('全部忽略', 'Ignore all')}
          </button>
          <button type="button" disabled={saving} onClick={() => void reviewAll('confirm')}>
            {t('一键确认', 'Confirm all')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setReviewQueue(true);
              setSelected(pending[0]);
            }}
          >
            {t('逐条审核', 'Review one by one')} ({pending.length})
          </button>
        </div>
      )}
      {!showingPending && !isDetail && !searching && archiveScope === 'self' && (
        <div className="avatar-library__dimension-grid" aria-label={t('关于我的内部维度')}>
          {SELF_DIMENSIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="avatar-library__dimension-card"
              onClick={() => openDimension(item.id)}
            >
              <span className="avatar-library__dimension-card-title">
                {t(item.label)}
                <small>
                  {countSelf(item.id)} {t('条', 'items')}
                </small>
              </span>
              <span className="avatar-library__dimension-card-description">
                {preview(archiveScope, item.id, t(item.description))}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {!showingPending && !isDetail && !searching && archiveScope === 'pattern' && (
        <div className="avatar-library__dimension-grid" aria-label={t('我的认识的内部维度')}>
          {PATTERN_DIMENSIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="avatar-library__dimension-card"
              onClick={() => openDimension(item.id)}
            >
              <span className="avatar-library__dimension-card-title">
                {t(item.label)}
                <small>
                  {countPattern(item.id)} {t('条', 'items')}
                </small>
              </span>
              <span className="avatar-library__dimension-card-description">
                {preview(archiveScope, item.id, t(item.description))}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {!showingPending && archiveScope === 'changes' && (
        <section aria-label={t('已确认的变化', 'Confirmed revisions')}>
          <p>
            {t(
              '仅展示你确认过的观点修订，不代表已经证明的成长。',
              'These are revisions you confirmed, not proof of growth.',
            )}
          </p>
          {changes.map((change) => (
            <article className="avatar-library__candidate" key={change.id}>
              <time>
                {new Date(change.at).toLocaleDateString(language === 'en' ? 'en-US' : 'zh-CN')}
              </time>
              <div className="avatar-library__revision-pair">
                <div>
                  <strong>{t('此前看法', 'Before')}</strong>
                  <p>{change.before}</p>
                </div>
                <div>
                  <strong>{t('最新认识', 'Now')}</strong>
                  <p>{change.after}</p>
                </div>
              </div>
              {archiveTags(graph, change.currentObjectId).length > 0 && (
                <p aria-label={t('关联标签', 'Related tags')}>
                  {archiveTags(graph, change.currentObjectId).map((tag) => `#${tag}`).join(' · ')}
                </p>
              )}
              {graph.edges.filter((edge) => edge.type === 'EVIDENCED_BY' && edge.fromId === change.currentObjectId).map((edge) => {
                const entry = entries.find((item) => item.id === edge.toId);
                return entry ? (
                  <button key={edge.id} type="button" disabled={!onSelectEntry} onClick={() => onSelectEntry?.(entry.id)}>
                    {t('查看触发修订的原始记录', 'View source record')} · {new Date(entry.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'zh-CN')}
                  </button>
                ) : null;
              })}
            </article>
          ))}
          {changes.length === 0 && (
            <p className="avatar-library__empty" role="status">
              {t('尚无已确认的观点修订。', 'No confirmed revisions yet.')}
            </p>
          )}
        </section>
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
              {t('返回')}
            </button>
          )}
          <h2>
            {showingPending
              ? t('待确认')
              : searching && !isDetail
                ? t('搜索结果')
                : t(detailTitle ?? '')}
          </h2>
        </div>
      )}
      {(showingPending || isDetail || searching) && (
        <div
          className="avatar-library__memories"
          aria-label={showingPending ? t('待确认记忆') : t('已确认记忆')}
        >
          {visible.length === 0 && archiveScope !== 'changes' && (
            <p className="avatar-library__empty">
              {query
                ? t('没有匹配的记忆')
                : archiveScope === 'pattern' && !showingPending
                  ? t('暂无已确认模式')
                  : t('暂无已确认记忆')}
            </p>
          )}
          {visible.map((memory) =>
            memory.status === 'candidate' ? (
              <article className="avatar-library__candidate" key={memory.id}>
                <small className="avatar-library__candidate-status">{t('待确认')}</small>
                <button
                  type="button"
                  className="avatar-library__candidate-statement"
                  onClick={() => setSelected(memory)}
                >
                  {selfMemoryVoice(memory.statement)}
                </button>
                <div className="avatar-library__candidate-actions" hidden={selected !== null}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveMemory(memory, memory.statement, 'rejected')}
                  >
                    {t('忽略')}
                  </button>
                  <button
                    type="button"
                    className="avatar-library__candidate-confirm"
                    disabled={saving}
                    onClick={() => void saveMemory(memory, memory.statement, 'confirmed')}
                  >
                    {t('确认记住')}
                  </button>
                </div>
              </article>
            ) : (
              <button
                key={memory.id}
                type="button"
                className="avatar-library__row"
                onClick={() => setSelected(memory)}
              >
                <span className="avatar-library__row-content">
                  <span>{selfMemoryVoice(memory.statement)}</span>
                  <small className="avatar-library__privacy">
                    {!memory.privacy.aiVisible && <PrivateVisibilityIcon />}
                    {memory.privacy.aiVisible ? t('允许 AI 可见') : t('仅自己可见')}
                  </small>
                  {memory.status === 'retained_after_source_delete' ? (
                    <small className="avatar-library__retained">
                      {t('已保留 · 原始经历已删除')}
                    </small>
                  ) : null}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ),
          )}
        </div>
      )}
      {selected && (
        <AvatarMemoryDetail
          key={selected.id}
          busy={saving}
          memory={selected}
          entries={entries}
          onClose={() => {
            setSelected(null);
            setReviewQueue(false);
          }}
          onSave={(statement, status) => saveMemory(selected, statement, status)}
          onSupersede={supersede}
          onToggleGuardrail={(enabled) => void toggleGuardrail(selected, enabled)}
        />
      )}
    </section>
  );
}

import { useState, type FC } from 'react';
import { ChevronDown, Link2 } from 'lucide-react';
import type { DiaryEntry, ExperienceEdge, ExperienceEdgeKind, Language, Theme } from '../types';
import type { TopicTrajectory } from '../services/topicTrajectory';

type RelatedExperienceDisclosureProps = {
  entry: DiaryEntry;
  language: Language;
  onSelectEntry: (entry: DiaryEntry) => void;
  relatedEntries: DiaryEntry[];
  theme: Theme;
  trajectory?: TopicTrajectory | null;
  onConfirmEdge?: (
    targetEntryId: string,
    kind: Extract<ExperienceEdgeKind, 'supports' | 'contradicts'>,
  ) => void;
  onResetEdge?: (targetEntryId: string) => void;
};

const summarize = (content: string): string => {
  const compact = content.replace(/\s+/g, ' ').trim();
  return compact.length > 72 ? `${compact.slice(0, 72)}…` : compact;
};

const edgeLabel = (entry: DiaryEntry, targetId: string, isZh: boolean): string => {
  const kind = entry.experienceEdges?.find((edge) => edge.targetEntryId === targetId)?.kind;
  if (kind === 'supports') return isZh ? '支持' : 'Supports';
  if (kind === 'contradicts') return isZh ? '矛盾' : 'Contradicts';
  return isZh ? '同主题' : 'Same theme';
};

const edgeExplanation = (
  edge: ExperienceEdge | undefined,
  isZh: boolean,
): string => {
  if (edge?.source === 'user-confirmed') {
    return isZh ? '依据：已确认的经验反馈' : 'Basis: confirmed experience feedback';
  }
  return isZh ? '依据：本地语义与标签关联' : 'Basis: local semantics and tags';
};

export const RelatedExperienceDisclosure: FC<RelatedExperienceDisclosureProps> = ({
  entry,
  language,
  onSelectEntry,
  relatedEntries,
  theme,
  trajectory,
  onConfirmEdge,
  onResetEdge,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isZh = language === 'zh';
  const panelId = `related-experiences-${entry.id}`;
  const displayedRelatedEntries = trajectory
    ? trajectory.nodes.filter((node) => node.relation !== 'current').map((node) => node.entry)
    : relatedEntries;

  if (relatedEntries.length === 0) return null;

  return (
    <section
      className={`related-experiences ${theme === 'light' ? 'related-experiences--light' : ''}`}
      aria-label={isZh ? '保存后的关联经验' : 'Related experiences after saving'}
    >
      <button
        type="button"
        className="related-experiences__toggle"
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <Link2 aria-hidden="true" className="h-4 w-4" />
        <span>
          {isZh
            ? `已关联到过去 ${relatedEntries.length} 条经验`
            : `Linked to ${relatedEntries.length} past experiences`}
        </span>
        <small>{isZh ? '按需查看' : 'Explore when useful'}</small>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 ${expanded ? 'related-experiences__chevron--expanded' : ''}`}
        />
      </button>

      {expanded && (
        <div id={panelId} className="related-experiences__expanded">
          {trajectory && (
            <header className="related-experiences__trajectory-head">
              <span>{isZh ? '主题轨迹' : 'Topic trajectory'}</span>
              <strong>{trajectory.label}</strong>
              <small>
                {new Date(trajectory.startedAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')}
                {' → '}
                {new Date(trajectory.updatedAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')}
              </small>
            </header>
          )}
          <div className="related-experiences__list">
          {displayedRelatedEntries.map((relatedEntry) => {
            const edge = entry.experienceEdges?.find(
              (candidate) => candidate.targetEntryId === relatedEntry.id,
            );
            return (
            <div key={relatedEntry.id} className="related-experiences__item">
              <button
                type="button"
                className="related-experiences__open"
                onClick={() => onSelectEntry(relatedEntry)}
                aria-label={isZh ? `查看关联经验 ${relatedEntry.title}` : `Open related experience ${relatedEntry.title}`}
              >
              <span>
                {new Date(relatedEntry.createdAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')}
              </span>
              <em className="related-experiences__edge-label">
                {edgeLabel(entry, relatedEntry.id, isZh)}
              </em>
              <strong>{relatedEntry.title}</strong>
              <small>{summarize(relatedEntry.content)}</small>
              </button>
              <small className="related-experiences__explanation">
                {edgeExplanation(edge, isZh)}
              </small>
              {onConfirmEdge && edge?.source !== 'user-confirmed' && (
                <div className="related-experiences__confirm" aria-label={isZh ? '确认经验关系' : 'Confirm relationship'}>
                  <span>{isZh ? '这条经验与此刻？' : 'How does this relate?'}</span>
                  <button type="button" onClick={() => onConfirmEdge(relatedEntry.id, 'supports')}>
                    {isZh ? '相互支持' : 'Supports'}
                  </button>
                  <button type="button" onClick={() => onConfirmEdge(relatedEntry.id, 'contradicts')}>
                    {isZh ? '彼此矛盾' : 'Contradicts'}
                  </button>
                </div>
              )}
              {edge?.source === 'user-confirmed' && (
                <div className="related-experiences__confirmed">
                  <small>{isZh ? '已确认，可随时修正' : 'Confirmed; you can revise it anytime'}</small>
                  {onConfirmEdge && edge.kind === 'supports' && (
                    <button type="button" onClick={() => onConfirmEdge(relatedEntry.id, 'contradicts')}>
                      {isZh ? '改为矛盾' : 'Change to contradicts'}
                    </button>
                  )}
                  {onConfirmEdge && edge.kind === 'contradicts' && (
                    <button type="button" onClick={() => onConfirmEdge(relatedEntry.id, 'supports')}>
                      {isZh ? '改为支持' : 'Change to supports'}
                    </button>
                  )}
                  {onResetEdge && (
                    <button type="button" onClick={() => onResetEdge(relatedEntry.id)}>
                      {isZh ? '撤销判断' : 'Reset judgment'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )})}
          {trajectory && (
            <div className="related-experiences__current" aria-label={isZh ? '主题轨迹当前节点' : 'Current trajectory node'}>
              <span>{new Date(entry.createdAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')}</span>
              <em>{isZh ? '此刻' : 'Now'}</em>
              <strong>{entry.title}</strong>
            </div>
          )}
          </div>
        </div>
      )}
    </section>
  );
};

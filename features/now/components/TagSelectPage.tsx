import React, { useId, useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { CONFIG } from '../constants/config';
import { EVENT_TAGS, EVENT_TAG_HINTS, MOOD_TAGS } from '../constants/tags';
import { readCustomAnchors, writeCustomAnchors } from '../state/nowStorage';
import type { NowDraft } from '../types/now';

interface TagSelectPageProps {
  draft: NowDraft;
  setDraft: (updater: NowDraft | ((draft: NowDraft) => NowDraft)) => void;
  onBack: () => void;
  showToast: (message: string) => void;
}

export const TagSelectPage: React.FC<TagSelectPageProps> = ({
  draft,
  setDraft,
  onBack,
  showToast,
}) => {
  const hintId = useId();
  const [moodTags, setMoodTags] = useState(draft.mood_tags);
  const [eventTags, setEventTags] = useState(draft.event_tags);
  const [customAnchors, setCustomAnchors] = useState(readCustomAnchors);

  const toggle = (
    tag: string,
    values: string[],
    setValues: (values: string[]) => void,
    max: number,
  ) => {
    if (values.includes(tag)) {
      const next = values.filter((item) => item !== tag);
      setValues(next);
      setDraft((current) => ({
        ...current,
        [setValues === setMoodTags ? 'mood_tags' : 'event_tags']: next,
      }));
      return;
    }
    if (values.length >= max) {
      showToast('最多选择 3 个');
      return;
    }
    const next = [...values, tag];
    setValues(next);
    setDraft((current) => ({
      ...current,
      [setValues === setMoodTags ? 'mood_tags' : 'event_tags']: next,
    }));
  };

  const isCustomTag = (tag: string) =>
    customAnchors.includes(tag) && !MOOD_TAGS.includes(tag) && !EVENT_TAGS.includes(tag);

  const deleteCustomTag = (tag: string) => {
    if (!isCustomTag(tag)) return;
    const next = customAnchors.filter((item) => item !== tag);
    writeCustomAnchors(next);
    setCustomAnchors(next);
    setMoodTags((current) => current.filter((item) => item !== tag));
    setEventTags((current) => current.filter((item) => item !== tag));
    setDraft((current) => ({
      ...current,
      mood_tags: current.mood_tags.filter((item) => item !== tag),
      event_tags: current.event_tags.filter((item) => item !== tag),
    }));
  };

  const deleteButton = (tag: string, section: string) =>
    isCustomTag(tag) ? (
      <button
        type="button"
        className="now-custom-tag-delete"
        aria-label={`删除${section}自定义标签 ${tag}`}
        onClick={() => deleteCustomTag(tag)}
      >
        <X size={12} aria-hidden="true" />
      </button>
    ) : null;

  const addCustomAnchor = (target: 'mood' | 'event') => {
    const value = window.prompt('输入自定义锚点，2～12 字')?.trim();
    if (!value) return;
    if (value.length < 2 || value.length > 12) {
      showToast('自定义锚点需为 2～12 字');
      return;
    }
    const next = Array.from(new Set([...customAnchors, value]));
    setCustomAnchors(next);
    writeCustomAnchors(next);
    if (target === 'mood' && !moodTags.includes(value)) {
      toggle(value, moodTags, setMoodTags, CONFIG.MAX_MOOD_TAGS);
    }
    if (target === 'event' && !eventTags.includes(value)) {
      toggle(value, eventTags, setEventTags, CONFIG.MAX_EVENT_TAGS);
    }
  };

  return (
    <main className="now-page now-tags-page">
      <header className="now-header">
        <button type="button" className="now-icon-button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <div className="now-time">选择标签</div>
        <span aria-hidden="true" />
      </header>
      <section className="now-tag-section">
        <h2>心情</h2>
        <div className="now-chip-grid">
          {Array.from(new Set([...MOOD_TAGS, ...customAnchors])).map((tag) => (
            <div key={tag} className={isCustomTag(tag) ? 'now-tag-item is-custom' : 'now-tag-item'}>
              <button
                type="button"
                className={moodTags.includes(tag) ? 'is-selected' : ''}
                aria-pressed={moodTags.includes(tag)}
                onClick={() => toggle(tag, moodTags, setMoodTags, CONFIG.MAX_MOOD_TAGS)}
              >
                {tag}
              </button>
              {deleteButton(tag, '心情')}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addCustomAnchor('mood')}
            aria-label="为心情添加自定义锚点"
          >
            <Plus size={14} /> 自定义锚点
          </button>
        </div>
        <div className="now-event-tag-heading">
          <h2>事件</h2>
          <button
            type="button"
            onClick={() => addCustomAnchor('event')}
            aria-label="为事件添加自定义锚点"
          >
            <Plus size={14} /> 自定义
          </button>
        </div>
        <div className="now-chip-grid now-event-tag-grid">
          {Array.from(
            new Set([
              ...EVENT_TAGS.filter((tag) => tag !== '自定义锚点'),
              ...customAnchors,
              ...eventTags,
            ]),
          ).map((tag, index) => (
            <div key={tag} className={isCustomTag(tag) ? 'now-tag-item is-custom' : 'now-tag-item'}>
              <button
                type="button"
                className={eventTags.includes(tag) ? 'is-selected' : ''}
                aria-label={tag}
                aria-describedby={EVENT_TAG_HINTS[tag] ? `${hintId}-${index}` : undefined}
                aria-pressed={eventTags.includes(tag)}
                onClick={() => toggle(tag, eventTags, setEventTags, CONFIG.MAX_EVENT_TAGS)}
              >
                <span>{tag}</span>
                {EVENT_TAG_HINTS[tag] && (
                  <span id={`${hintId}-${index}`} role="tooltip" className="now-event-tag-hint">
                    {EVENT_TAG_HINTS[tag]}
                  </span>
                )}
              </button>
              {deleteButton(tag, '事件')}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

import React, { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { CONFIG } from '../constants/config';
import { EVENT_TAGS, MOOD_TAGS, TAG_SLOGAN } from '../constants/tags';
import { validateTags } from '../state/nowRules';
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
      setValues(values.filter((item) => item !== tag));
      return;
    }
    if (values.length >= max) {
      showToast('最多选择 3 个');
      return;
    }
    setValues([...values, tag]);
  };

  const addCustomAnchor = () => {
    const value = window.prompt('输入自定义锚点，2～12 字')?.trim();
    if (!value) return;
    if (value.length < 2 || value.length > 12) {
      showToast('自定义锚点需为 2～12 字');
      return;
    }
    const next = Array.from(new Set([...customAnchors, value]));
    setCustomAnchors(next);
    writeCustomAnchors(next);
    if (!eventTags.includes(value)) toggle(value, eventTags, setEventTags, CONFIG.MAX_EVENT_TAGS);
  };

  const confirm = () => {
    const validation = validateTags(moodTags, eventTags, customAnchors);
    if (validation.ok === false) {
      showToast(validation.message);
      return;
    }
    setDraft((current) => ({ ...current, mood_tags: moodTags, event_tags: eventTags }));
    onBack();
  };

  return (
    <main className="now-page now-tags-page">
      <header className="now-header">
        <button type="button" className="now-icon-button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <div className="now-time">选择标签</div>
        <button type="button" className="now-text-button" onClick={confirm}>
          确定
        </button>
      </header>
      <section className="now-tag-section">
        <p>{TAG_SLOGAN}</p>
        <h2>心情</h2>
        <div className="now-chip-grid">
          {MOOD_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={moodTags.includes(tag) ? 'is-selected' : ''}
              onClick={() => toggle(tag, moodTags, setMoodTags, CONFIG.MAX_MOOD_TAGS)}
            >
              {tag}
            </button>
          ))}
        </div>
        <h2>事件</h2>
        <div className="now-chip-grid">
          {[...EVENT_TAGS.filter((tag) => tag !== '自定义锚点'), ...customAnchors].map((tag) => (
            <button
              key={tag}
              type="button"
              className={eventTags.includes(tag) ? 'is-selected' : ''}
              onClick={() => toggle(tag, eventTags, setEventTags, CONFIG.MAX_EVENT_TAGS)}
            >
              {tag}
            </button>
          ))}
          <button type="button" onClick={addCustomAnchor}>
            <Plus size={14} /> 自定义锚点
          </button>
        </div>
      </section>
    </main>
  );
};

import { describe, expect, it } from 'vitest';
import {
  createEmptyDraft,
  buildAdaptiveFollowup,
  getCanSend,
  getDisabledSendReason,
  hasRecordableInformation,
  isContentSufficient,
  validateMaterials,
  validateTags,
} from './nowRules';
import type { Material } from '../types/now';

const material = (type: Material['type'], index = 0): Material => ({
  id: `${type}-${index}`,
  type,
  url: '',
  sort_order: index,
});

describe('nowRules', () => {
  it('requires content, mood tag and event tag before sending', () => {
    const draft = createEmptyDraft(new Date('2026-06-15T10:37:00+08:00'));

    expect(getCanSend(draft)).toBe(false);
    expect(getDisabledSendReason(draft)).toBe('请先输入内容或添加素材');

    const withText = { ...draft, text: '今天完成一次重要记录' };
    expect(getDisabledSendReason(withText)).toBe('请选择心情标签');

    const withMood = { ...withText, mood_tags: ['平静'] };
    expect(getDisabledSendReason(withMood)).toBe('请选择事件标签');

    expect(getCanSend({ ...withMood, event_tags: ['个人成长'] })).toBe(true);
  });

  it('validates material count and exclusivity', () => {
    expect(validateMaterials([material('image'), material('audio')])).toEqual({ ok: true });
    expect(validateMaterials([material('video'), material('audio')])).toEqual({
      ok: false,
      message: '视频不能与图片、链接或音频同时添加',
    });
    expect(validateMaterials(Array.from({ length: 9 }, (_, index) => material('image', index)))).toEqual({
      ok: false,
      message: '图片最多 8 张',
    });
  });

  it('validates tag ranges and allows confirmed custom anchors', () => {
    expect(validateTags(['焦虑'], ['职业发展'])).toEqual({ ok: true });
    expect(validateTags([], ['职业发展'])).toEqual({ ok: false, message: '请选择心情标签' });
    expect(validateTags(['焦虑'], ['我的锚点'], ['我的锚点'])).toEqual({ ok: true });
    expect(validateTags(['焦虑'], ['未知事件'])).toEqual({ ok: false, message: '存在未知事件标签' });
  });

  it('marks avatar content sufficient by message count, length, or audio duration', () => {
    expect(isContentSufficient([{ content: '短句' }])).toBe(false);
    expect(isContentSufficient([{ content: 'h l v y z y' }, { content: 'tu x w y y' }])).toBe(false);
    expect(isContentSufficient([{ content: '今天工作项目推进完了，我感觉比较平静。' }, { content: '晚上复盘时发现自己完成了一个小目标。' }])).toBe(true);
    expect(isContentSufficient([{ content: '这是一段超过五十个字的记录内容，用来说明今天发生了什么，以及我当时具体怎么想、怎么感受，也补充了为什么这件事值得被存进过去。' }])).toBe(true);
    expect(isContentSufficient([{ content: '', audioMs: 30_000 }])).toBe(true);
  });

  it('detects whether avatar input carries recordable information', () => {
    expect(hasRecordableInformation('h l v y z y')).toBe(false);
    expect(hasRecordableInformation('随便几个字')).toBe(false);
    expect(hasRecordableInformation('今天工作项目推进完了，我感觉比较平静。')).toBe(true);
  });

  it('builds adaptive followups from the user answer', () => {
    expect(buildAdaptiveFollowup([{ content: '我很不开心' }], 0)).toContain('具体发生了什么');
    expect(buildAdaptiveFollowup([{ content: '今天工作项目推进完了' }], 0)).toContain('感受');
    expect(buildAdaptiveFollowup([{ content: 'h l v y z y' }], 0)).toContain('什么时候');
  });
});

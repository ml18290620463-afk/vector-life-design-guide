import { describe, expect, it } from 'vitest';
import {
  createEmptyDraft,
  buildAdaptiveFollowup,
  buildRecordFromDraft,
  buildCompanionAcknowledgement,
  buildAvatarStructuredInsight,
  getCanSend,
  getDisabledSendReason,
  hasRecordableInformation,
  inferAvatarMoodTags,
  isContentSufficient,
  recordToDiaryEntry,
  selectAvatarRecallMemories,
  wantsDirectRecord,
  validateMaterials,
  validateTags,
} from './nowRules';
import type { Material } from '../types/now';
import type { DiaryEntry } from '../../../types';

const material = (type: Material['type'], index = 0): Material => ({
  id: `${type}-${index}`,
  type,
  url: '',
  sort_order: index,
});

const entry = (overrides: Partial<DiaryEntry>): DiaryEntry => ({
  id: 'entry-1',
  title: '2026年7月6日13点45分',
  content: '今天客户没有认可我的项目方案，我很不开心，但也意识到准备还不够。',
  createdAt: Date.parse('2026-07-06T13:45:00+08:00'),
  updatedAt: Date.parse('2026-07-06T13:45:00+08:00'),
  tags: ['心情:难过', '事件:职业发展'],
  isLocked: false,
  ...overrides,
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

  it('converts a now record into a past diary entry with materials and tags', () => {
    const draft = {
      ...createEmptyDraft(new Date('2026-07-09T10:30:00+08:00')),
      text: '今天完成一次重要复盘',
      materials: [
        {
          id: 'audio-1',
          type: 'audio' as const,
          url: 'data:audio/webm;base64,AAAA',
          meta: { title: '录音 5s' },
          sort_order: 0,
        },
      ],
      mood_tags: ['平静'],
      event_tags: ['个人成长'],
    };

    const record = buildRecordFromDraft(draft, 'manual');
    const entry = recordToDiaryEntry(record);

    expect(entry.title).toBe('2026年7月9日10点30分');
    expect(entry.content).toContain('今天完成一次重要复盘');
    expect(entry.content).toContain('素材:');
    expect(entry.content).toContain('- audio: 录音 5s');
    expect(entry.tags).toEqual(['心情:平静', '事件:个人成长']);
    expect(entry.nowMaterials).toEqual(draft.materials);
  });

  it('validates material count and exclusivity', () => {
    expect(validateMaterials([material('image'), material('audio')])).toEqual({ ok: true });
    expect(validateMaterials([material('video'), material('audio')])).toEqual({
      ok: false,
      message: '视频不能与图片、链接或音频同时添加',
    });
    expect(
      validateMaterials(Array.from({ length: 9 }, (_, index) => material('image', index))),
    ).toEqual({
      ok: false,
      message: '图片最多 8 张',
    });
  });

  it('validates tag ranges and allows confirmed custom anchors', () => {
    expect(validateTags(['焦虑'], ['职业发展'])).toEqual({ ok: true });
    expect(validateTags([], ['职业发展'])).toEqual({ ok: false, message: '请选择心情标签' });
    expect(validateTags(['焦虑'], ['我的锚点'], ['我的锚点'])).toEqual({ ok: true });
    expect(validateTags(['焦虑'], ['未知事件'])).toEqual({
      ok: false,
      message: '存在未知事件标签',
    });
  });

  it('marks avatar content sufficient by message count, length, or audio duration', () => {
    expect(isContentSufficient([{ content: '短句' }])).toBe(false);
    expect(isContentSufficient([{ content: 'h l v y z y' }, { content: 'tu x w y y' }])).toBe(
      false,
    );
    expect(
      isContentSufficient([
        { content: '今天工作项目推进完了，我感觉比较平静。' },
        { content: '晚上复盘时发现自己完成了一个小目标。' },
      ]),
    ).toBe(true);
    expect(
      isContentSufficient([
        {
          content:
            '这是一段超过五十个字的记录内容，用来说明今天发生了什么，以及我当时具体怎么想、怎么感受，也补充了为什么这件事值得被存进过去。',
        },
      ]),
    ).toBe(true);
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

  it('treats negated happy as sadness instead of happiness', () => {
    expect(inferAvatarMoodTags('我今天不开心')).toEqual(['难过']);
    expect(buildCompanionAcknowledgement([{ content: '我今天不开心' }], 0)).toContain(
      '感受偏向「难过」',
    );
  });

  it('responds by extracting record points before continuing the conversation', () => {
    const reply = buildCompanionAcknowledgement(
      [{ content: '今天项目汇报被客户认可了，我很感动，也意识到提前演练很重要。' }],
      0,
    );

    expect(reply).toContain('我先提炼到');
    expect(reply).toContain('项目汇报');
    expect(reply).toContain('感动');
    expect(reply).toMatch(/结果|影响|记录/);
  });

  it('stops follow-up when the user asks to record directly', () => {
    expect(wantsDirectRecord('不想说了 直接记录')).toBe(true);
    const reply = buildCompanionAcknowledgement(
      [{ content: '今天项目汇报被客户认可了，我很开心。' }, { content: '不想说了 直接记录' }],
      1,
    );

    expect(reply).toContain('不追问');
    expect(reply).toContain('记录完毕');
  });

  it('absorbs user corrections instead of repeating the same prompt', () => {
    const reply = buildCompanionAcknowledgement(
      [{ content: '今天项目汇报被客户认可了。' }, { content: '我都说了开心了' }],
      1,
    );

    expect(reply).toContain('开心');
    expect(reply).toContain('不再重复追这个点');
  });

  it('recalls related past records from tags and keywords', () => {
    const memories = selectAvatarRecallMemories(
      [
        entry({ id: 'work-sad' }),
        entry({
          id: 'family-calm',
          content: '晚上和家人散步，我感觉很平静。',
          tags: ['心情:平静', '事件:家庭情感'],
          createdAt: Date.parse('2026-07-05T20:00:00+08:00'),
        }),
      ],
      '今天工作汇报又不开心',
    );

    expect(memories[0]?.id).toBe('work-sad');
    expect(memories[0]?.tags).toContain('难过');
  });

  it('mentions recalled memory without crowding the conversation', () => {
    const memories = selectAvatarRecallMemories([entry({ id: 'work-sad' })], '客户方案不开心');
    const reply = buildCompanionAcknowledgement(
      [{ content: '今天客户方案被否定，我不开心' }],
      0,
      memories,
    );

    expect(reply).toContain('我联想到一条过去记录');
    expect(reply).toContain('不会替你下结论');
    expect(reply).toContain('感受偏向「难过」');
  });

  it('anchors structured insight only to unique recalled entry ids', () => {
    const memory = selectAvatarRecallMemories([entry({ id: 'work-sad' })], '客户方案')[0]!;
    const anchored = buildAvatarStructuredInsight([{ content: '今天客户方案又被否定' }], [memory, memory]);
    const conversationOnly = buildAvatarStructuredInsight([{ content: '今天有一场会议' }]);

    expect(anchored.evidenceEntryIds).toEqual(['work-sad']);
    expect(conversationOnly.evidenceEntryIds).toEqual([]);
  });
});

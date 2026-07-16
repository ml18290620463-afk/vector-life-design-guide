import { describe, expect, it } from 'vitest';
import { getEntryMediaGroups } from './entryMedia';
import type { DiaryEntry } from '../types';

const entry: DiaryEntry = {
  id: 'entry-media',
  title: '媒体记录',
  content: '',
  createdAt: 1,
  tags: [],
  isLocked: false,
  nowMaterials: [
    { id: 'image-1', type: 'image', url: 'data:image/png;base64,AAAA', sort_order: 0 },
    { id: 'audio-1', type: 'audio', url: 'data:audio/webm;base64,BBBB', sort_order: 1 },
    { id: 'video-1', type: 'video', url: 'data:video/mp4;base64,CCCC', sort_order: 2 },
    {
      id: 'link-1',
      type: 'link',
      url: 'https://example.com',
      meta: { title: '文章标题' },
      sort_order: 3,
    },
  ],
};

describe('getEntryMediaGroups', () => {
  it('groups modern and legacy entry media consistently', () => {
    const groups = getEntryMediaGroups(entry, [
      'audio: data:audio/webm;base64,DDDD',
      'video: data:video/mp4;base64,EEEE',
      'link: https://legacy.example.com',
    ]);

    expect(groups.imageMaterials).toHaveLength(1);
    expect(groups.audioMaterials).toHaveLength(1);
    expect(groups.videoMaterials).toHaveLength(1);
    expect(groups.linkMaterials).toHaveLength(1);
    expect(groups.legacyAudioUrls).toEqual(['data:audio/webm;base64,DDDD']);
    expect(groups.legacyVideoUrls).toEqual(['data:video/mp4;base64,EEEE']);
    expect(groups.legacyLinkMaterials).toEqual(['https://legacy.example.com']);
  });
});

import { describe, expect, it } from 'vitest';
import { getAudioPlayLabel, getMaterialAlt, getMaterialTitle } from './materialDisplay';

describe('materialDisplay', () => {
  it('prefers explicit material title, then local path, url, fallback label', () => {
    expect(
      getMaterialTitle({
        type: 'image',
        url: 'data:image/png;base64,AAAA',
        local_path: 'photo.png',
        meta: { title: '我的照片' },
      }),
    ).toBe('我的照片');
    expect(getMaterialTitle({ type: 'audio', url: '', local_path: 'voice.m4a' })).toBe(
      'voice.m4a',
    );
    expect(getMaterialTitle({ type: 'link', url: 'https://example.com' })).toBe(
      'https://example.com',
    );
    expect(getMaterialTitle({ type: 'video', url: '', meta: {} })).toBe('视频素材');
  });

  it('uses material title as image alt text', () => {
    expect(getMaterialAlt({ type: 'image', url: '', meta: { title: '山谷图片' } })).toBe(
      '山谷图片',
    );
  });

  it('localizes audio play label', () => {
    expect(getAudioPlayLabel('zh')).toBe('▶ 播放录音');
    expect(getAudioPlayLabel('en')).toBe('▶ Play audio');
  });
});

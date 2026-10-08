import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants/config';
import { queuePendingRecord, readCustomAnchors, writeCustomAnchors } from './nowStorage';

const record = {
  created_at: '2026-07-09T10:30:00.000Z',
  display_time: '2026年7月9日10点30分',
  text: '今天完成一次复盘',
  materials: [],
  mood_tags: ['平静'],
  event_tags: ['个人成长'],
  source: 'manual' as const,
  avatar_session_id: null,
};

describe('nowStorage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('reads only string custom anchors and ignores invalid storage', () => {
    localStorage.setItem(STORAGE_KEYS.customAnchors, JSON.stringify(['自定义', 123, null]));

    expect(readCustomAnchors()).toEqual(['自定义']);

    localStorage.setItem(STORAGE_KEYS.customAnchors, '{bad json');
    expect(readCustomAnchors()).toEqual([]);
  });

  it('writes custom anchors', () => {
    expect(writeCustomAnchors(['复盘'])).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customAnchors) ?? '[]')).toEqual(['复盘']);
  });

  it('appends pending records to offline queue', () => {
    expect(queuePendingRecord(record)).toBe(true);
    expect(queuePendingRecord({ ...record, text: '第二条' })).toBe(true);

    const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingRecords) ?? '[]');
    expect(pending).toHaveLength(2);
    expect(pending[0].text).toBe('今天完成一次复盘');
    expect(pending[1].text).toBe('第二条');
  });
});

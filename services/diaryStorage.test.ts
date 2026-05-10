import { beforeEach, describe, expect, it } from 'vitest';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_WARN_BYTES,
  DiaryStorageKeys,
  entriesPayloadExceedsMirror,
  evaluateAttachmentSize,
  getDiaryStorageKeys,
  mirrorDiaryValue,
  readDiaryJson,
  readDiaryString,
  removeDiaryMirror,
} from './diaryStorage';

describe('diaryStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds user-scoped storage keys', () => {
    expect(getDiaryStorageKeys('user-1')).toMatchObject({
      entries: DiaryStorageKeys.entries,
      selectedStars: 'vector_selected_stars_user-1',
      materials: 'vector_materials_user-1',
    });
  });

  it('mirrors and reads string values', () => {
    expect(mirrorDiaryValue(DiaryStorageKeys.passwordHash, 'hash')).toBe(true);
    expect(readDiaryString(DiaryStorageKeys.passwordHash)).toBe('hash');
  });

  it('reads mirrored json values', () => {
    mirrorDiaryValue(DiaryStorageKeys.principles, JSON.stringify([{ id: 'p1' }]));
    expect(readDiaryJson<{ id: string }[]>(DiaryStorageKeys.principles)).toEqual([{ id: 'p1' }]);
  });

  it('removes mirrored values', () => {
    mirrorDiaryValue(DiaryStorageKeys.initializedFlag, 'true');
    removeDiaryMirror(DiaryStorageKeys.initializedFlag);
    expect(readDiaryString(DiaryStorageKeys.initializedFlag)).toBeUndefined();
  });

  describe('evaluateAttachmentSize', () => {
    it('returns ok for small files', () => {
      expect(evaluateAttachmentSize(1024)).toEqual({ verdict: 'ok', bytes: 1024 });
    });

    it('returns warn at the soft threshold', () => {
      expect(evaluateAttachmentSize(ATTACHMENT_WARN_BYTES)).toEqual({
        verdict: 'warn',
        bytes: ATTACHMENT_WARN_BYTES,
      });
    });

    it('returns reject above the hard limit', () => {
      const verdict = evaluateAttachmentSize(ATTACHMENT_MAX_BYTES + 1);
      expect(verdict.verdict).toBe('reject');
    });

    it('treats invalid sizes as zero (ok)', () => {
      expect(evaluateAttachmentSize(Number.NaN)).toEqual({ verdict: 'ok', bytes: 0 });
      expect(evaluateAttachmentSize(-5)).toEqual({ verdict: 'ok', bytes: 0 });
    });
  });

  describe('entriesPayloadExceedsMirror', () => {
    it('returns false for small payloads', () => {
      expect(entriesPayloadExceedsMirror(50_000)).toBe(false);
    });

    it('returns true for payloads above the mirror skip limit', () => {
      expect(entriesPayloadExceedsMirror(150_000)).toBe(true);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { DiaryEntry } from '../types';
import { getInitialViewerAccessState, isEntryTimeLocked } from './viewerAccessState';

const baseEntry: DiaryEntry = {
  id: 'entry-1',
  title: 'Title',
  content: 'Hello world',
  createdAt: 1,
  tags: [],
  isLocked: false,
};

describe('viewerAccessState', () => {
  it('reads plain entries immediately when no master password is set', () => {
    expect(getInitialViewerAccessState(baseEntry, null, 100)).toEqual({
      viewState: 'reading',
      decrypted: true,
      decryptedContent: 'Hello world',
    });
  });

  it('keeps entries sealed when a master password exists', () => {
    expect(getInitialViewerAccessState(baseEntry, 'secret', 100)).toEqual({
      viewState: 'sealed',
      decrypted: false,
      decryptedContent: '',
    });
  });

  it('keeps encrypted entries sealed', () => {
    expect(getInitialViewerAccessState({ ...baseEntry, isEncrypted: true }, null, 100)).toEqual({
      viewState: 'sealed',
      decrypted: false,
      decryptedContent: '',
    });
  });

  it('keeps time-locked entries sealed until the unlock moment', () => {
    const entry = { ...baseEntry, unlockAt: 200 };

    expect(isEntryTimeLocked(entry, 100)).toBe(true);
    expect(getInitialViewerAccessState(entry, null, 100)).toEqual({
      viewState: 'sealed',
      decrypted: false,
      decryptedContent: '',
    });

    expect(isEntryTimeLocked(entry, 200)).toBe(false);
    expect(getInitialViewerAccessState(entry, null, 200)).toEqual({
      viewState: 'reading',
      decrypted: true,
      decryptedContent: 'Hello world',
    });
  });
});

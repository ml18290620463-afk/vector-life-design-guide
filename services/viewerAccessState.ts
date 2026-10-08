import { DiaryEntry } from '../types';

export type ViewerAccessState = {
  decrypted: boolean;
  decryptedContent: string;
  viewState: 'sealed' | 'reading';
};

export const isEntryTimeLocked = (entry: DiaryEntry, now = Date.now()) =>
  Boolean(entry.unlockAt && now < entry.unlockAt);

export const getInitialViewerAccessState = (
  entry: DiaryEntry,
  masterPassword: string | null,
  now = Date.now(),
): ViewerAccessState => {
  const timeLocked = isEntryTimeLocked(entry, now);
  const canReadImmediately = !timeLocked && !masterPassword && !entry.isEncrypted;

  return {
    viewState: canReadImmediately ? 'reading' : 'sealed',
    decrypted: canReadImmediately,
    decryptedContent: canReadImmediately ? entry.content : '',
  };
};

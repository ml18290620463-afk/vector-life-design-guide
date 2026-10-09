import { useEffect, useState } from 'react';
import type { DiaryEntry } from '../types';
import { SecurityService } from '../services/securityService';

/** Session-only read model. Never pass this array back to the storage delta writer. */
export function useReadableEntries(
  stored: DiaryEntry[],
  isUnlocked: boolean,
  password: string | null,
) {
  const [result, setResult] = useState<{
    source: DiaryEntry[];
    password: string | null;
    entries: DiaryEntry[];
    error: string | null;
  }>();
  useEffect(() => {
    let cancelled = false;
    if (!isUnlocked) {
      setResult(undefined);
      return;
    }
    void Promise.all(
      stored.map(async (entry) => {
        if (entry.isLocked || (entry.unlockAt && entry.unlockAt > Date.now()))
          return {
            ...entry,
            content: '',
            reflection: undefined,
            attachment: undefined,
            nowMaterials: undefined,
          };
        if (!entry.isEncrypted) return entry;
        if (!password) throw new Error('Missing session key');
        return {
          ...entry,
          content: await SecurityService.decrypt(entry.content, password),
          isEncrypted: false,
        };
      }),
    ).then(
      (entries) => {
        if (!cancelled) setResult({ source: stored, password, entries, error: null });
      },
      () => {
        if (!cancelled)
          setResult({
            source: stored,
            password,
            entries: [],
            error:
              '部分记录无法解密。请确认使用本机密令解锁，或从完好的备份恢复。原始资料未被修改。',
          });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [stored, isUnlocked, password]);
  const current = isUnlocked && result?.source === stored && result.password === password;
  return { entries: current ? result.entries : [], error: current ? result.error : null };
}

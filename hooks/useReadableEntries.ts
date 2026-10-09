import { useEffect, useState } from 'react';
import type { DiaryEntry } from '../types';
import { SecurityService } from '../services/securityService';

export interface UnreadableEntry {
  id: string;
  reason: string;
}

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
    unreadableEntries: UnreadableEntry[];
  }>();
  useEffect(() => {
    let cancelled = false;
    if (!isUnlocked) {
      setResult(undefined);
      return;
    }
    void Promise.allSettled(
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
    ).then((settled) => {
      if (cancelled) return;
      const entries: DiaryEntry[] = [];
      const unreadableEntries: UnreadableEntry[] = [];
      settled.forEach((item, index) => {
        if (item.status === 'fulfilled') entries.push(item.value);
        else {
          const reason = item.reason instanceof Error ? item.reason.message : '无法读取此记录';
          unreadableEntries.push({ id: stored[index].id, reason });
        }
      });
      setResult({
        source: stored,
        password,
        entries,
        unreadableEntries,
        error:
          unreadableEntries.length > 0
            ? `已跳过 ${unreadableEntries.length} 条无法解密或读取的记录。请确认本机密令或从完好的备份恢复；原始资料未被修改。`
            : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [stored, isUnlocked, password]);
  const current = isUnlocked && result?.source === stored && result.password === password;
  return {
    entries: current ? result.entries : [],
    error: current ? result.error : null,
    unreadableEntries: current ? result.unreadableEntries : [],
  };
}

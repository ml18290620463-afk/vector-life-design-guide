import { useEffect, useMemo, useState } from 'react';
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
            supplements: undefined,
          };
        const supplements = (entry.supplements ?? []).some((item) => item.isEncrypted)
          ? await Promise.all((entry.supplements ?? []).map((item) =>
              item.isEncrypted
                ? password
                  ? SecurityService.decrypt(item.content, password).then((content) => ({ ...item, content, isEncrypted: false }))
                  : Promise.reject(new Error('Missing session key'))
                : item,
            ))
          : entry.supplements;
        if (!entry.isEncrypted) return { ...entry, supplements };
        if (!password) throw new Error('Missing session key');
        return {
          ...entry,
          content: await SecurityService.decrypt(entry.content, password),
          supplements,
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
  // Storage refreshes replace the array even when the evidence is unchanged.
  // Resolve plaintext synchronously and reuse decrypted content only for the
  // same ciphertext and session key, so an async read never blanks the timeline.
  const entries = useMemo(() => {
    if (!isUnlocked) return [];
    if (current) return result.entries;
    const previous = result?.password === password ? result : undefined;
    const sources = new Map(previous?.source.map((entry) => [entry.id, entry]));
    const readable = new Map(previous?.entries.map((entry) => [entry.id, entry]));
    return stored.flatMap((entry) => {
      if (entry.isLocked || (entry.unlockAt && entry.unlockAt > Date.now()))
        return [
          {
            ...entry,
            content: '',
            reflection: undefined,
            attachment: undefined,
            nowMaterials: undefined,
            supplements: undefined,
          },
        ];
      if (!entry.isEncrypted) return [entry];
      const source = sources.get(entry.id);
      const cached = readable.get(entry.id);
      if (
        source?.isEncrypted &&
        source.content === entry.content &&
        cached &&
        !source.isLocked &&
        !(source.unlockAt && source.unlockAt > Date.now())
      )
        return [{ ...entry, content: cached.content, supplements: entry.supplements?.some((item) => item.isEncrypted) ? cached.supplements : entry.supplements, isEncrypted: false }];
      return [];
    });
  }, [stored, isUnlocked, password, current, result]);
  return {
    entries,
    error: current ? result.error : null,
    unreadableEntries: current ? result.unreadableEntries : [],
  };
}

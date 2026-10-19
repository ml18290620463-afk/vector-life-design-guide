import type { DiaryEntry } from '../types';
import { SecurityService } from './securityService';

export interface UnreadableEntry {
  id: string;
  reason: string;
}

/** Decodes records independently. It never mutates the stored records. */
export async function decodeEntries(
  entries: DiaryEntry[],
  password: string | null,
): Promise<{ entries: DiaryEntry[]; unreadableEntries: UnreadableEntry[] }> {
  const settled = await Promise.allSettled(
    entries.map(async (entry) => {
      const decode = async (content: string, encrypted?: boolean) => {
        if (!encrypted) return content;
        if (!password) throw new Error('Missing session key');
        return SecurityService.decrypt(content, password);
      };
      return {
        ...entry,
        content: await decode(entry.content, entry.isEncrypted),
        isEncrypted: false,
        supplements: entry.supplements
          ? await Promise.all(
              entry.supplements.map(async (supplement) => ({
                ...supplement,
                content: await decode(supplement.content, supplement.isEncrypted),
                isEncrypted: false,
              })),
            )
          : undefined,
      };
    }),
  );
  const readable: DiaryEntry[] = [];
  const unreadableEntries: UnreadableEntry[] = [];
  settled.forEach((item, index) => {
    if (item.status === 'fulfilled') readable.push(item.value);
    else
      unreadableEntries.push({
        id: entries[index].id,
        reason: item.reason instanceof Error ? item.reason.message : '无法读取此记录',
      });
  });
  return { entries: readable, unreadableEntries };
}

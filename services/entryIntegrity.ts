import type { DiaryEntry } from '../types';
import { sanitizeDiaryEntry } from './diaryDataRead';
import { preparedVaultTransaction } from './vaultTransaction';
import { SecurityService } from './securityService';
import { get } from 'idb-keyval';

/** Normal updates may change organization and derived links, never recorded evidence. */
export function assertEntryUnchanged(previous: DiaryEntry, next: DiaryEntry) {
  const fields = [
    'title',
    'content',
    'createdAt',
    'tags',
    'attachment',
    'nowMaterials',
    'supplements',
  ] as const;
  const before = sanitizeDiaryEntry(previous);
  const after = sanitizeDiaryEntry(next);
  if (fields.some((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])))
    throw new Error('历史记录不可修改，请使用补充');
}

export async function appendEntrySupplement(
  keys: { entries: string; backup: string },
  entryId: string,
  content: string,
  supplementId: string,
  password?: string | null,
) {
  const text = content.trim();
  if (!text || !supplementId) throw new Error('请填写补充内容');
  const current = ((await get<DiaryEntry[]>(keys.entries)) ?? []).find((item) => item.id === entryId);
  if (!current) throw new Error('记录已不存在');
  if (current.isEncrypted && password) {
    try {
      await SecurityService.decrypt(current.content, password);
    } catch {
      throw new Error('密令不正确，无法补充记录');
    }
  }
  const prior = current.supplements?.find((item) => item.id === supplementId);
  if (prior) {
    const priorText = prior.isEncrypted
      ? await SecurityService.decrypt(prior.content, password!)
      : prior.content;
    if (priorText !== text) throw new Error('补充已保存，请重新打开后继续补充');
  }
  const encrypted = Boolean(password);
  const storedContent = encrypted ? await SecurityService.encrypt(text, password!) : text;
  return preparedVaultTransaction([keys.entries, keys.backup], (values) => {
    const entries = (values[keys.entries] as DiaryEntry[] | undefined) ?? [];
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) throw new Error('记录已不存在');
    if (entry.isLocked || (entry.unlockAt && entry.unlockAt > Date.now()) || (entry.isEncrypted && !password))
      throw new Error('请先解锁记录');
    const existing = entry.supplements?.find((item) => item.id === supplementId);
    if (existing) {
      if (!existing.isEncrypted && existing.content !== text)
        throw new Error('补充已保存，请重新打开后继续补充');
      return entries;
    }
    const next = entries.map((item) =>
      item.id === entryId
        ? {
            ...item,
            supplements: [
              ...(item.supplements ?? []),
              { id: supplementId, content: storedContent, createdAt: Date.now(), isEncrypted: encrypted },
            ],
          }
        : item,
    );
    values[keys.entries] = next;
    values[keys.backup] = next;
    return next;
  });
}

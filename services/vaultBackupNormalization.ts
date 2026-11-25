import type { FutureState } from '../types/future';
import type { DiaryEntry } from '../types';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};
export type Row = { id: string; [key: string]: unknown };
export function rows(value: unknown, key = 'id'): asserts value is Row[] {
  if (
    !Array.isArray(value) ||
    value.some((r) => !r || typeof r[key] !== 'string' || !r[key]) ||
    new Set(value.map((r) => r[key])).size !== value.length
  )
    throw new Error('备份包含无效或重复编号');
}
export function strings(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
    throw new Error('备份标签格式无效');
}
export const scalarDomain = (name: string) =>
  ['guidingStars', 'selectedStars', 'user_custom_anchors'].includes(name);
/** Legacy standalone attachments had no ID. Normalize local data only; imports
 * still undergo strict validation. Content + occurrence keeps duplicate files
 * distinct and makes repeated export/merge idempotent without rewriting storage. */
export function materialRows(value: unknown[]): unknown[] {
  const used = new Set(
    value.flatMap((item) =>
      item && typeof item === 'object' && 'id' in item && typeof item.id === 'string' && item.id
        ? [item.id]
        : [],
    ),
  );
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('素材格式无效');
    const row = item as Record<string, unknown>;
    if (row.id !== undefined && row.id !== null && row.id !== '') return row;
    const { id: _legacyId, ...content } = row;
    const digest = bytesToHex(sha256(new TextEncoder().encode(canonical(content))));
    let occurrence = 1;
    let id = `legacy-material-${digest}-${occurrence}`;
    while (used.has(id)) id = `legacy-material-${digest}-${++occurrence}`;
    used.add(id);
    return { ...content, id };
  });
}

export function mergeRows(current: unknown[], incoming: unknown[], key = 'id'): unknown[] {
  const merged = [...current];
  for (const raw of incoming) {
    const row = raw as Record<string, unknown>;
    const old = merged.find((r) => (r as Record<string, unknown>)[key] === row[key]);
    if (old && canonical(old) !== canonical(row))
      throw new Error(
        `编号冲突：${String(row[key])}。未导入任何数据，请检查并使用内容一致的备份。`,
      );
    if (!old) merged.push(row);
  }
  return merged;
}

export function validateBackupEntries(entries: DiaryEntry[]): void {
  for (const e of entries)
    if (
      typeof e.content !== 'string' ||
      typeof e.title !== 'string' ||
      !Number.isFinite(e.createdAt) ||
      !Array.isArray(e.tags) ||
      (e.supplements !== undefined &&
        (!Array.isArray(e.supplements) ||
          e.supplements.some(
            (item) =>
              !item ||
              typeof item.id !== 'string' ||
              typeof item.content !== 'string' ||
              !Number.isFinite(item.createdAt),
          ) ||
          new Set(e.supplements.map((item) => item.id)).size !== e.supplements.length))
    )
      throw new Error('记录格式无效');
}

export function validateBackupLinks(
  records: DiaryEntry[],
  actions: Row[],
  future: FutureState,
): void {
  const entries = new Set(records.map((e) => e.id));
  const goalIds = new Set(future.goals.map((g) => g.id));
  for (const a of actions)
    if (
      typeof a.title !== 'string' ||
      !['pending', 'active', 'completed', 'abandoned'].includes(String(a.status)) ||
      (a.goalId && !goalIds.has(String(a.goalId)))
    )
      throw new Error('行动关联无效');
  for (const e of future.events)
    if (
      (e.sourceEntryId && !entries.has(e.sourceEntryId)) ||
      (e.sourceActionId && !actions.some((a) => a.id === e.sourceActionId))
    )
      throw new Error('成果来源缺失');
}

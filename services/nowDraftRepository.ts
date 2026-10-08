import { vaultTransaction } from './vaultTransaction';
import { PRIVATE_DRAFT_KEY } from './privateDraftKey';
import { createEmptyDraft } from '../features/now/state/nowRules';
import type { NowDraft } from '../features/now/types/now';

export interface DraftSnapshot {
  revision: number;
  draft: NowDraft | null;
}
const legacyKey = 'now_draft';
export function normalizeNowDraft(value: unknown): NowDraft {
  const v = value as Partial<NowDraft> | null;
  if (
    !v ||
    typeof v.text !== 'string' ||
    !Array.isArray(v.materials) ||
    typeof v.record_time !== 'string' ||
    !Number.isFinite(Date.parse(v.record_time))
  )
    throw new Error('草稿内容无法读取，原内容已保留。请勿清空浏览器数据。');
  const defaults = createEmptyDraft(new Date(v.record_time));
  if (
    v.materials.some(
      (m) =>
        !m ||
        typeof m.id !== 'string' ||
        !['image', 'video', 'link', 'audio'].includes(m.type) ||
        typeof m.url !== 'string' ||
        !Number.isFinite(m.sort_order),
    ) ||
    [v.mood_tags, v.event_tags].some(
      (tags) =>
        tags !== undefined && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')),
    )
  )
    throw new Error('草稿素材或标签格式无法读取，原内容已保留。');
  return {
    ...defaults,
    ...v,
    submission_id:
      typeof v.submission_id === 'string' && v.submission_id
        ? v.submission_id
        : defaults.submission_id,
    display_time: typeof v.display_time === 'string' ? v.display_time : defaults.display_time,
    updated_at: typeof v.updated_at === 'string' ? v.updated_at : defaults.updated_at,
    mood_tags: v.mood_tags ?? [],
    event_tags: v.event_tags ?? [],
  };
}
export async function loadNowDraft(): Promise<DraftSnapshot> {
  // A legacy copy is removed only after a protected transaction has committed.
  const raw = localStorage.getItem(legacyKey);

  const row = await vaultTransaction([PRIVATE_DRAFT_KEY], (values) => {
    const stored = values[PRIVATE_DRAFT_KEY] as DraftSnapshot | undefined;
    if (stored) {
      if (!Number.isInteger(stored.revision) || stored.revision < 0)
        throw new Error('草稿版本无法读取，原内容已保留。');
      const normalized = stored.draft ? normalizeNowDraft(stored.draft) : null;
      const row = { ...stored, draft: normalized };
      values[PRIVATE_DRAFT_KEY] = row;
      return row;
    }
    const legacy = raw ? normalizeNowDraft(JSON.parse(raw)) : null;
    const initial = { revision: 0, draft: legacy };
    if (legacy) values[PRIVATE_DRAFT_KEY] = initial;
    return initial;
  });
  if (raw) localStorage.removeItem(legacyKey);
  return { ...row, draft: row.draft ? normalizeNowDraft(row.draft) : null };
}
export async function saveNowDraft(
  draft: NowDraft | null,
  revision: number,
): Promise<DraftSnapshot> {
  return vaultTransaction([PRIVATE_DRAFT_KEY], (values) => {
    const current = values[PRIVATE_DRAFT_KEY] as DraftSnapshot | undefined;
    if ((current?.revision ?? 0) !== revision)
      throw new Error('另一页面已更新草稿。本页内容仍保留，请先复制，再重新打开记录页。');
    const row = { revision: revision + 1, draft: draft ? normalizeNowDraft(draft) : null };
    values[PRIVATE_DRAFT_KEY] = row;
    return row;
  });
}

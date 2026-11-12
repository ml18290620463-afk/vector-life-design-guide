import { vaultTransaction } from './vaultTransaction';
import { FUTURE_DRAFT_KEY } from './privateDraftKey';

export interface FutureDraft {
  fields: Record<string, string>;
  updatedAt: number;
}
export interface FutureDraftSnapshot {
  revision: number;
  drafts: Record<string, FutureDraft>;
}
export function normalizeFutureDrafts(value: unknown): Record<string, FutureDraft> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('规划草稿格式无效');
  for (const [key, draft] of Object.entries(value)) {
    const d = draft as FutureDraft;
    if (
      !/^(vision|goal|action):[^\s]+$/.test(key) ||
      !d ||
      !Number.isFinite(d.updatedAt) ||
      !d.fields ||
      typeof d.fields !== 'object' ||
      Array.isArray(d.fields) ||
      Object.values(d.fields).some((v) => typeof v !== 'string')
    )
      throw new Error('规划草稿格式无效');
  }
  return value as Record<string, FutureDraft>;
}
export function loadFutureDrafts(): Promise<FutureDraftSnapshot> {
  return vaultTransaction(
    [FUTURE_DRAFT_KEY],
    (v) => {
      const row = v[FUTURE_DRAFT_KEY] as FutureDraftSnapshot | undefined;
      if (row && (!Number.isInteger(row.revision) || row.revision < 0))
        throw new Error('规划草稿版本无效');
      return { revision: row?.revision ?? 0, drafts: normalizeFutureDrafts(row?.drafts) };
    },
    true,
  );
}
export function saveFutureDraft(
  key: string,
  draft: FutureDraft | null,
  revision: number,
): Promise<FutureDraftSnapshot> {
  return vaultTransaction([FUTURE_DRAFT_KEY], (v) => {
    const current = v[FUTURE_DRAFT_KEY] as FutureDraftSnapshot | undefined;
    if ((current?.revision ?? 0) !== revision)
      throw new Error('其他页面已更新规划草稿；本页文字仍在，请复制后重新打开。');
    const drafts = { ...normalizeFutureDrafts(current?.drafts) };
    if (draft) drafts[key] = draft;
    else delete drafts[key];
    const next = { revision: revision + 1, drafts: normalizeFutureDrafts(drafts) };
    v[FUTURE_DRAFT_KEY] = next;
    return next;
  });
}

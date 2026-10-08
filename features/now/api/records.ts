import type { NowRecord } from '../types/now';

const stripLocalMaterialPayloads = (
  record: Omit<NowRecord, 'id' | 'sync_status'>,
): Omit<NowRecord, 'id' | 'sync_status'> => ({
  ...record,
  materials: record.materials.map((material) => ({
    ...material,
    url: material.type === 'link' ? material.url : '',
  })),
});

export const postRecord = async (record: Omit<NowRecord, 'id' | 'sync_status'>) => {
  const response = await fetch('/api/v1/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stripLocalMaterialPayloads(record)),
  });
  if (!response.ok) throw new Error('record-submit-failed');
  return (await response.json()) as { id: string; sync_status: 'synced' | 'pending' };
};

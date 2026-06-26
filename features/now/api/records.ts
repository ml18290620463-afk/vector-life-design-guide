import type { NowRecord } from '../types/now';

export const postRecord = async (record: Omit<NowRecord, 'id' | 'sync_status'>) => {
  const response = await fetch('/api/v1/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error('record-submit-failed');
  return (await response.json()) as { id: string; sync_status: 'synced' | 'pending' };
};

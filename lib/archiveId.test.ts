import { describe, expect, it } from 'vitest';
import { buildArchiveId } from './archiveId';

describe('buildArchiveId', () => {
  it('builds a stable archive label from year and entry id', () => {
    expect(buildArchiveId({ id: 'abcd-1234', createdAt: new Date('2026-07-09').getTime() })).toBe(
      'AR-26-ABCD',
    );
  });
});

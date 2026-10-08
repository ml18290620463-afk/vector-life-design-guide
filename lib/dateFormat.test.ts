import { describe, expect, it } from 'vitest';
import {
  formatDateDots,
  formatDateKey,
  formatEntryDateTime,
  formatMonthKey,
  formatNowDisplayTime,
  pad2,
} from './dateFormat';

const sample = new Date('2026-07-09T10:30:00+08:00');

describe('dateFormat', () => {
  it('formats now display time for record titles', () => {
    expect(formatNowDisplayTime(sample)).toBe('2026年7月9日10点30分');
  });

  it('formats stable archive keys and share dates', () => {
    expect(pad2(7)).toBe('07');
    expect(formatMonthKey(sample.getTime())).toBe('2026-07');
    expect(formatDateKey(sample.getTime())).toBe('2026-07-09');
    expect(formatDateDots(sample.getTime())).toBe('2026.07.09');
  });

  it('formats entry timestamps for Chinese timelines', () => {
    expect(formatEntryDateTime(sample.getTime(), 'zh')).toContain('2026');
    expect(formatEntryDateTime(sample.getTime(), 'zh')).toContain('7月9日');
  });
});

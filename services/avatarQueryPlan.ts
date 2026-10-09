import type { DiaryEntry } from '../types';

export interface AvatarTimeRange {
  start: number;
  end: number;
  label: string;
}

export interface AvatarQueryPlan {
  range?: AvatarTimeRange;
  kind: 'count_entries' | 'period_recall' | 'general_recall';
}

const localDay = (year: number, month: number, day = 1) => new Date(year, month, day).getTime();
const localYear = (date: Date) => date.getFullYear();
const localDayStart = (date: Date) => localDay(date.getFullYear(), date.getMonth(), date.getDate());

const monthRange = (year: number, monthIndex: number, label: string): AvatarTimeRange => ({
  start: localDay(year, monthIndex),
  end: localDay(year, monthIndex + 1),
  label,
});

const formatLocalDate = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
};

/** Weeks are calendar weeks in the user's current locale, starting on Monday. */
const weekRange = (now: number, offsetWeeks: number): AvatarTimeRange => {
  const today = new Date(now);
  const weekdayFromMonday = (today.getDay() + 6) % 7;
  const start = localDayStart(today) - (weekdayFromMonday + offsetWeeks * 7) * 86400000;
  const end = start + 7 * 86400000;
  return {
    start,
    end,
    label: `${offsetWeeks === 0 ? '本周' : '上周'}（${formatLocalDate(start)}至${formatLocalDate(end - 1)}）`,
  };
};

/** A deliberately small, explicit Chinese date grammar for locally verifiable queries. */
export const parseAvatarTimeRange = (
  question: string,
  now = Date.now(),
): AvatarTimeRange | undefined => {
  const date = new Date(now);
  const year = localYear(date);
  if (/今年/.test(question))
    return { start: localDay(year, 0), end: localDay(year + 1, 0), label: `${year} 年` };
  if (/去年/.test(question))
    return { start: localDay(year - 1, 0), end: localDay(year, 0), label: `${year - 1} 年` };
  if (/本周|这周|这个星期/.test(question)) return weekRange(now, 0);
  if (/上周|上星期/.test(question)) return weekRange(now, 1);
  if (/本月|这个月/.test(question))
    return monthRange(year, date.getMonth(), `${year} 年 ${date.getMonth() + 1} 月`);
  if (/上月|上个月/.test(question))
    return monthRange(
      year,
      date.getMonth() - 1,
      `${date.getMonth() === 0 ? year - 1 : year} 年 ${date.getMonth() === 0 ? 12 : date.getMonth()} 月`,
    );
  const span = question.match(/(\d{4})年(\d{1,2})月(?:至|到|-)(\d{1,2})月/);
  if (span) {
    const [, y, first, last] = span;
    const startMonth = Number(first) - 1;
    const endMonth = Number(last);
    if (startMonth >= 0 && startMonth < 12 && endMonth > startMonth && endMonth <= 12)
      return {
        start: localDay(Number(y), startMonth),
        end: localDay(Number(y), endMonth),
        label: `${y} 年 ${first} 月至${last} 月`,
      };
  }
  const day = question.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (day) {
    const [, y, m, d] = day;
    const start = localDay(Number(y), Number(m) - 1, Number(d));
    const parsed = new Date(start);
    if (
      parsed.getFullYear() === Number(y) &&
      parsed.getMonth() === Number(m) - 1 &&
      parsed.getDate() === Number(d)
    )
      return {
        start,
        end: localDay(Number(y), Number(m) - 1, Number(d) + 1),
        label: `${y} 年 ${m} 月 ${d} 日`,
      };
  }
  const month = question.match(/(\d{4})年(\d{1,2})月/);
  if (month && Number(month[2]) >= 1 && Number(month[2]) <= 12)
    return monthRange(Number(month[1]), Number(month[2]) - 1, `${month[1]} 年 ${month[2]} 月`);
  const days = question.match(/过去\s*(\d{1,3})\s*天/);
  if (days) {
    const end = now;
    return { start: end - Number(days[1]) * 86400000, end, label: `过去 ${days[1]} 天` };
  }
  return undefined;
};

export const isAccessibleDiaryEntry = (entry: DiaryEntry, now = Date.now()) =>
  !entry.isSample &&
  !entry.isLocked &&
  !entry.isEncrypted &&
  (!entry.unlockAt || entry.unlockAt <= now);

const isCountOnlyQuestion = (question: string) =>
  /(多少|几)(篇|条|个)?(日记|记录)|写了(多少|几)(篇|条)?(日记|记录)|(?:日记|记录).*(多少|几)(篇|条|个)?/.test(
    question,
  ) && !/(为什么|为何|怎么|建议|分析|总结)/.test(question);

export const parseAvatarQueryPlan = (question: string, now = Date.now()): AvatarQueryPlan => {
  const range = parseAvatarTimeRange(question, now);
  if (isCountOnlyQuestion(question)) return { kind: 'count_entries', range };
  return range ? { kind: 'period_recall', range } : { kind: 'general_recall' };
};

export const buildDeterministicEntryCountReply = (
  question: string,
  entries: DiaryEntry[],
  now = Date.now(),
): string | null => {
  const plan = parseAvatarQueryPlan(question, now);
  if (plan.kind !== 'count_entries') return null;
  const count = entries.filter(
    (entry) =>
      isAccessibleDiaryEntry(entry, now) &&
      (!plan.range || (entry.createdAt >= plan.range.start && entry.createdAt < plan.range.end)),
  ).length;
  const label = plan.range?.label ?? '目前';
  return `在${label}，你留下了 ${count} 条可访问记录。这个数字不包含示例、锁定、加密或尚未解锁的记录，也不代表未记录的生活。`;
};

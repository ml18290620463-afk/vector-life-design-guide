import { DiaryEntry, GroupingMode, Language } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { asLegacyEntry, getEntryTimestamp } from './entryCompat';

interface GroupDashboardEntriesArgs {
  filteredEntries: DiaryEntry[];
  paginatedEntries: DiaryEntry[];
  groupingMode: GroupingMode;
  language: Language;
  labels: TranslationDictionary;
}

const isUnknownGroup = (key: string) =>
  key.includes('未分类') || key.includes('UNCA') || key.includes('未知') || key.includes('UNKNOWN');

const getUnknownTimeLabel = (language: Language) =>
  language === 'zh' ? '🕒 未分类时间' : 'UNCATEGORIZED TIME';

const getDashboardGroupKey = (
  entry: DiaryEntry,
  groupingMode: Exclude<GroupingMode, 'none'>,
  language: Language,
  labels: TranslationDictionary,
) => {
  const ts = getEntryTimestamp(asLegacyEntry(entry));
  const date = new Date(ts);
  const isInvalid = isNaN(date.getTime()) || ts === 0;

  if (isInvalid) return getUnknownTimeLabel(language);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const yearLabel = labels.year || '年';
  const monthLabel = labels.month || '月';

  const isMonthUndefined =
    date.getMonth() === 0 &&
    date.getDate() === 1 &&
    date.getHours() === 0 &&
    date.getMinutes() === 0;
  const isDayUndefined = date.getDate() === 1 && date.getHours() === 0 && date.getMinutes() === 0;

  if (groupingMode === 'year') return `${y}${yearLabel}`;

  if (groupingMode === 'month') {
    return isMonthUndefined
      ? language === 'zh'
        ? `${y}${yearLabel} / 未明确月份`
        : `${y} / UNKNOWN MONTH`
      : `${y}${yearLabel}${m}${monthLabel}`;
  }

  if (isMonthUndefined || isDayUndefined) {
    const mLabel = isMonthUndefined
      ? language === 'zh'
        ? '未知月'
        : 'UNK_MONTH'
      : `${m}${monthLabel}`;
    return language === 'zh'
      ? `${y}${yearLabel}${mLabel} / 未明确日期`
      : `${y} ${mLabel} / UNKNOWN DAY`;
  }

  return `${y}-${m}-${d}`;
};

export const groupDashboardEntries = ({
  filteredEntries,
  paginatedEntries,
  groupingMode,
  language,
  labels,
}: GroupDashboardEntriesArgs): Record<string, DiaryEntry[]> => {
  if (groupingMode === 'none') return { ALL: paginatedEntries };

  const groups: Record<string, DiaryEntry[]> = {};

  filteredEntries.forEach((entry) => {
    const key = getDashboardGroupKey(entry, groupingMode, language, labels);
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });

  Object.keys(groups).forEach((key) => {
    groups[key].sort(
      (a, b) => getEntryTimestamp(asLegacyEntry(b)) - getEntryTimestamp(asLegacyEntry(a)),
    );
  });

  return groups;
};

export const sortDashboardGroupKeys = (groupedEntries: Record<string, DiaryEntry[]>) =>
  Object.keys(groupedEntries).sort((a, b) => {
    if (a === 'ALL') return -1;
    if (b === 'ALL') return 1;

    const isAUnknown = isUnknownGroup(a);
    const isBUnknown = isUnknownGroup(b);

    if (isAUnknown && !isBUnknown) return 1;
    if (!isAUnknown && isBUnknown) return -1;

    return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
  });

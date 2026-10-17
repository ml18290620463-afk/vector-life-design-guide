import type { DiaryEntry } from '../types';
import type { AvatarUnderstandingVersion } from '../features/avatar/types';
import { isAccessibleDiaryEntry } from './avatarQueryPlan';

const DECISION_QUESTION = /(选择|决策|要不要|应不应该|利弊|取舍|怎么办|怎么选|该不该)/;
const STOP_WORDS = new Set([
  '我', '的', '了', '是', '在', '这', '那', '一个', '现在', '过去', '可以', '应该', '是否',
  '还是', '怎么', '怎样', '什么', '事情', '选择', '决策', '要不要', '应不应该', '怎么办', '怎么选',
]);

export interface AvatarDecisionSupport {
  text: string;
  entryIds: string[];
}

const compact = (value: string) => value.replace(/\s+/g, '');

const queryTerms = (question: string) => {
  const cleaned = compact(question).replace(new RegExp(DECISION_QUESTION.source, 'g'), '');
  const pieces = cleaned.match(/[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}/g) ?? [];
  const terms = new Set<string>();
  for (const piece of pieces) {
    if (/^[\u4e00-\u9fff]+$/.test(piece)) {
      // Chinese has no word boundaries. Short phrase fragments let “接受这个
      // 工作机会” find an entry containing “工作机会”, without pretending that a
      // semantically similar but unrecorded event is evidence.
      for (let size = 2; size <= Math.min(6, piece.length); size += 1) {
        for (let start = 0; start + size <= piece.length; start += 1) {
          const term = piece.slice(start, start + size);
          if (!STOP_WORDS.has(term)) terms.add(term);
        }
      }
    } else if (!STOP_WORDS.has(piece)) {
      terms.add(piece);
    }
  }
  return [...terms].sort((a, b) => b.length - a.length).slice(0, 40);
};

const entryText = (entry: DiaryEntry) =>
  compact([entry.title, entry.content, entry.reflection, ...(entry.supplements ?? []).map((item) => item.content)].filter(Boolean).join(' '));

const excerpt = (entry: DiaryEntry) => {
  const text = entry.content.replace(/\s+/g, ' ').trim();
  return `${new Date(entry.createdAt).toLocaleDateString('zh-CN')}：${text.slice(0, 68)}${text.length > 68 ? '…' : ''}`;
};

/**
 * A decision answer is deliberately a review frame, not a recommendation.
 * It cites only readable source records and treats every difference as an
 * open question for the person to verify.
 */
export function buildAvatarDecisionSupport(
  question: string,
  entries: DiaryEntry[],
  understandings: AvatarUnderstandingVersion[],
  now = Date.now(),
): AvatarDecisionSupport | null {
  if (!DECISION_QUESTION.test(question)) return null;
  const terms = queryTerms(question);
  const ranked = entries
    .filter((entry) => isAccessibleDiaryEntry(entry, now))
    .map((entry) => {
      const text = entryText(entry);
      const matchedTerms = terms.filter((term) => text.includes(term));
      // A single generic two-character overlap is too weak to call an event
      // “similar”. Require a 3+ character phrase, unless this is the only
      // available query vocabulary (for example, “搬家”).
      const longestMatch = Math.max(0, ...matchedTerms.map((term) => term.length));
      const score = matchedTerms.reduce((total, term) => total + term.length * term.length, 0);
      return { entry, score, longestMatch };
    })
    .filter((item) => item.score > 0 && (item.longestMatch >= 3 || !terms.some((term) => term.length >= 3)))
    .sort((a, b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt)
    .slice(0, 3);

  if (!ranked.length) {
    return {
      text: '我还没有找到能和这次选择核对的可访问经历，所以不把任何判断说成你的历史规律。你最在意的取舍是什么，或最担心失去什么？',
      entryIds: [],
    };
  }

  const confirmed = understandings
    .filter((item) => item.status === 'confirmed' && item.sourceEntryIds.some((id) => ranked.some(({ entry }) => entry.id === id)))
    .slice(0, 2);
  const history = ranked.map(({ entry }, index) => `${index + 1}. ${excerpt(entry)}`).join('\n');
  const pattern = confirmed.length
    ? `\n\n已确认的相关认识：${confirmed.map((item) => item.statement).join('；')}。它们只是回看线索，不替这次作答。`
    : '';
  return {
    text: `可以先把这次选择放在过去经历旁边看，而不急着定结论。\n\n相似经历\n${history}\n\n过去结果\n上面记录的是当时发生的事实；其中没有足够一致的已记录结果时，我不会把它概括成“总会怎样”。${pattern}\n\n当前差异\n请先核对：这次的目标、限制、关系和可承受代价，和当时分别有什么不同？\n\n待验证条件\n在决定前，你可以写下一个最小验证：下一步做什么、何时回看、什么结果会让你调整。选择仍由你自己作出。`,
    entryIds: ranked.map(({ entry }) => entry.id),
  };
}

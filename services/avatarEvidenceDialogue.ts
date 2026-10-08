import type { DiaryEntry, Principle } from '../types';
import type { AvatarUnderstandingVersion } from '../features/avatar/types';

const excerpt = (entry: DiaryEntry) =>
  `${new Date(entry.createdAt).toLocaleDateString('zh-CN')}，你写过：「${entry.content.replace(/\s+/g, ' ').slice(0, 220)}${entry.content.length > 220 ? '…' : ''}」`;
const outcomeLabels = {
  helpful: '有帮助',
  partial: '部分有帮助',
  unhelpful: '没有帮助',
  unrelated: '不相关',
};
/** Deterministic answers use actual linked records, never statistical confidence or invented outcomes. */
export function answerAvatarEvidence(
  question: string,
  patterns: AvatarUnderstandingVersion[],
  principles: Principle[],
  entries: DiaryEntry[],
): string | null {
  const query = question.trim();
  if (!/(模式|原则|依据|证据|相关经历|关联经历|为什么.*(?:觉得|认为)|适用|例外)/.test(query))
    return null;
  // Don't interpret a narrated experience mentioning a principle as a knowledge request.
  if (
    !/(哪些|什么|为什么|怎样|怎么|告诉|看看|查看|了解|列出|依据|证据|适用|例外|[?？])/.test(query)
  )
    return null;
  const active = patterns.filter((p) => p.status === 'confirmed');
  const available = entries.filter((e) => !e.isSample && (!e.unlockAt || e.unlockAt <= Date.now()));
  const evidence = (ids: string[]) => {
    const linked = [...new Set(ids)].flatMap((id) => available.find((e) => e.id === id) ?? []);
    return linked.length
      ? linked.slice(0, 5).map(excerpt).join('\n') +
          (linked.length > 5 ? '\n这里先列出其中五段经历。' : '')
      : '目前没有可读取的关联经历，不能据此补充推断。';
  };
  const detail = /(依据|证据|相关经历|关联经历|为什么|适用|例外)/.test(query);
  const selectedPatterns = active.filter(
    (p) => query.includes(p.statement) || (p.patternLabel && query.includes(p.patternLabel)),
  );
  const selectedPrinciples = principles.filter((p) => query.includes(p.text));
  const patternRows = selectedPatterns.length ? selectedPatterns : active.slice(0, 8);
  const principleRows = selectedPrinciples.length ? selectedPrinciples : principles.slice(0, 8);
  const onlyPrinciples = /原则/.test(query) && !/模式/.test(query);
  const onlyPatterns = /模式/.test(query) && !/原则/.test(query);
  const paragraphs: string[] = [];
  if (!onlyPrinciples)
    paragraphs.push(
      patternRows.length
        ? '你认可的模式：\n' +
            patternRows
              .map(
                (p, i) =>
                  `${i + 1}. ${p.statement}${detail ? '\n' + evidence(p.sourceEntryIds) : ''}`,
              )
              .join('\n\n')
        : '目前还没有你认可的模式。候选理解不会作为你的既定特征。',
    );
  if (!onlyPatterns)
    paragraphs.push(
      principleRows.length
        ? '你保留的原则：\n' +
            principleRows
              .map((p, i) => {
                const feedback = available.flatMap((e) =>
                  (e.principleFeedback ?? [])
                    .filter((f) => f.principleId === p.id)
                    .map(
                      (f) => `${excerpt(e)}，你对这次应用的反馈是「${outcomeLabels[f.outcome]}」。`,
                    ),
                );
                return (
                  `${i + 1}. ${p.text}` +
                  (detail
                    ? `\n${evidence([...(p.derivedFromEntryIds ?? []), ...active.filter((pattern) => p.sourcePatternIds?.includes(pattern.id)).flatMap((pattern) => pattern.sourceEntryIds)])}\n${p.application ? `你设置的适用情境：${p.application.trigger}；尝试：${p.application.action}。` : '尚未明确适用情境。'}\n${feedback.length ? feedback.slice(0, 5).join('\n') : '还没有记录这条原则实际应用后的反馈。'}`
                    : '')
                );
              })
              .join('\n\n')
        : '目前还没有保存的原则。',
    );
  paragraphs.push(
    detail
      ? '这些是你记录的经历与反馈，是否适合其他情境还需要你判断。未记录的例外仍未知。你可以说“修正我的模式”，再选择具体的一条。'
      : '你可以继续问“这些模式和原则有哪些关联经历？”或说“修正我的模式”。',
  );
  return paragraphs.join('\n\n');
}

/** Ordinals refer to the offered snapshot, never to a newly reordered list. */
export function resolvePatternCorrection(
  content: string,
  activePatterns: AvatarUnderstandingVersion[],
  offeredIds: string[] | null,
) {
  const selected = activePatterns.filter(
    (item) =>
      content.includes(item.statement) ||
      (item.patternLabel && content.includes(item.patternLabel)),
  );
  const ordinal = offeredIds !== null && /^\s*(?:第)?(\d+)(?:条)?\s*$/.exec(content);
  const target =
    selected.length === 1
      ? selected[0]
      : ordinal
        ? activePatterns.find((item) => item.id === offeredIds![Number(ordinal[1]) - 1])
        : activePatterns.length === 1
          ? activePatterns[0]
          : undefined;
  return { target, ordinal: !!ordinal };
}

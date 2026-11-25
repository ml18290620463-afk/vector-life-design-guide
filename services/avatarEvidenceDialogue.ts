import { ontologyPrivacyToken } from './aiPrivacy';
import { selectAvatarOntologyContext } from './avatarOntologyContext';
import { currentPrinciples } from './principleRevision';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { isAccessibleDiaryEntry } from './avatarQueryPlan';
import type { DiaryEntry, Principle } from '../types';

/** Deterministic answers use actual linked records, never statistical confidence or invented outcomes. */
export function answerAvatarEvidence(
  question: string,
  graph: AvatarOntologySnapshot,
  principles: Principle[],
  entries: DiaryEntry[],
  language: 'zh' | 'en' = 'zh',
): string | null {
  const en = language === 'en';
  const t = (zh: string, english: string) => (en ? english : zh);
  const excerpt = (entry: DiaryEntry) => {
    const date = new Date(entry.createdAt).toLocaleDateString(en ? 'en-US' : 'zh-CN');
    const text =
      entry.content.replace(/\s+/g, ' ').slice(0, 220) + (entry.content.length > 220 ? '…' : '');
    return en ? `${date}, you wrote: “${text}”` : `${date}，你写过：「${text}」`;
  };
  const outcomeLabels = {
    helpful: t('有帮助', 'helpful'),
    partial: t('部分有帮助', 'partly helpful'),
    unhelpful: t('没有帮助', 'unhelpful'),
    unrelated: t('不相关', 'unrelated'),
  };
  const query = question.trim();
  if (
    !/(模式|原则|依据|证据|相关经历|关联经历|为什么.*(?:觉得|认为)|适用|例外|\b(?:patterns?|principles?|evidence|sources?|exceptions?)\b)/i.test(
      query,
    )
  )
    return null;
  // Don't interpret a narrated experience mentioning a principle as a knowledge request.
  if (
    !/(哪些|什么|为什么|怎样|怎么|告诉|看看|查看|了解|列出|依据|证据|适用|例外|\b(?:what|which|why|how|show|list|explain)\b|[?？])/i.test(
      query,
    )
  )
    return null;
  const eligible = selectAvatarOntologyContext(
    graph,
    entries,
    ontologyPrivacyToken(graph, entries, undefined, [], principles),
  );
  const active = eligible
    .filter(({ object }) => object.domain === 'my_understanding')
    .map(({ object }) => object);
  const sourceEntryIds = (id: string) =>
    eligible
      .find(({ object }) => object.id === id)
      ?.evidence.filter(
        (edge) => edge.sourceKind === 'now_entry' || edge.sourceKind === 'past_experience',
      )
      .map((edge) => edge.toId) ?? [];
  principles = currentPrinciples(principles).filter(
    (p) =>
      p.aiVisibility === 'allowed' &&
      (p.sourcePatternIds ?? []).every((id) => active.some((object) => object.id === id)) &&
      (p.derivedFromEntryIds ?? []).every((id) =>
        entries.some((entry) => entry.id === id && isAccessibleDiaryEntry(entry)),
      ) &&
      // This deterministic record answer has no authoritative practice repository.
      !p.derivedFromPracticeIds?.length,
  );
  const available = entries.filter((e) => isAccessibleDiaryEntry(e));
  const evidence = (ids: string[]) => {
    const linked = [...new Set(ids)].flatMap((id) => available.find((e) => e.id === id) ?? []);
    return linked.length
      ? linked.slice(0, 5).map(excerpt).join('\n') +
          (linked.length > 5
            ? t('\n这里先列出其中五段经历。', '\nShowing the first five linked records.')
            : '')
      : t(
          '目前没有可读取的关联经历，不能据此补充推断。',
          'No accessible linked records are available. I cannot infer missing evidence.',
        );
  };
  const detail =
    /(依据|证据|相关经历|关联经历|为什么|适用|例外|\b(?:patterns?|principles?|evidence|sources?|exceptions?)\b)/i.test(
      query,
    );
  const selectedPatterns = active.filter((p) => query.includes(p.statement));
  const selectedPrinciples = principles.filter((p) => query.includes(p.text));
  const patternRows = selectedPatterns.length ? selectedPatterns : active.slice(0, 8);
  const principleRows = selectedPrinciples.length ? selectedPrinciples : principles.slice(0, 8);
  const onlyPrinciples = /原则|\bprinciples?\b/i.test(query) && !/模式|\bpatterns?\b/i.test(query);
  const onlyPatterns = /模式|\bpatterns?\b/i.test(query) && !/原则|\bprinciples?\b/i.test(query);
  const paragraphs: string[] = [];
  if (!onlyPrinciples)
    paragraphs.push(
      patternRows.length
        ? t('你认可的模式：\n', 'Patterns you confirmed:\n') +
            patternRows
              .map(
                (p, i) =>
                  `${i + 1}. ${p.statement}${detail ? '\n' + evidence(sourceEntryIds(p.id)) : ''}`,
              )
              .join('\n\n')
        : t(
            '目前还没有你认可的模式。候选理解不会作为你的既定特征。',
            'No confirmed patterns yet. Candidates are not treated as established traits.',
          ),
    );
  if (!onlyPatterns)
    paragraphs.push(
      principleRows.length
        ? t('你保留的原则：\n', 'Principles you kept:\n') +
            principleRows
              .map((p, i) => {
                const feedback = available.flatMap((e) =>
                  (e.principleFeedback ?? [])
                    .filter((f) => f.principleId === p.id)
                    .map((f) =>
                      en
                        ? `${excerpt(e)}. Your feedback: ${outcomeLabels[f.outcome]}.`
                        : `${excerpt(e)}，你对这次应用的反馈是「${outcomeLabels[f.outcome]}」。`,
                    ),
                );
                return (
                  `${i + 1}. ${p.text}` +
                  (detail
                    ? `\n${evidence([...(p.derivedFromEntryIds ?? []), ...active.filter((pattern) => p.sourcePatternIds?.includes(pattern.id)).flatMap((pattern) => sourceEntryIds(pattern.id))])}\n${p.application ? t(`你设置的适用情境：${p.application.trigger}；尝试：${p.application.action}${p.application.exception ? `；不适用情况：${p.application.exception}` : ''}。`, `Your situation: ${p.application.trigger}; try: ${p.application.action}${p.application.exception ? `; exception: ${p.application.exception}` : ''}.`) : t('尚未明确适用情境。', 'Applicable situations have not been specified.')}\n${feedback.length ? feedback.slice(0, 5).join('\n') : t('还没有记录这条原则实际应用后的反馈。', 'No actual application feedback has been recorded for this principle.')}`
                    : '')
                );
              })
              .join('\n\n')
        : t('目前还没有保存的原则。', 'No saved principles yet.'),
    );
  paragraphs.push(
    detail
      ? t(
          '这些是你记录的经历与反馈，是否适合其他情境还需要你判断。未记录的例外仍未知。你可以说“修正我的模式”，再选择具体的一条。',
          'These are your recorded experiences and feedback. You decide whether they apply elsewhere. Unrecorded exceptions remain unknown. You can edit a specific pattern in the memory library.',
        )
      : t(
          '你可以继续问“这些模式和原则有哪些关联经历？”或说“修正我的模式”。',
          'You can ask “What evidence supports these patterns and principles?” or edit them in the memory library.',
        ),
  );
  return paragraphs.join('\n\n');
}

/** Ordinals refer to the offered snapshot, never to a newly reordered list. */
export function resolvePatternCorrection<T extends { id: string; statement: string }>(
  content: string,
  activePatterns: T[],
  offeredIds: string[] | null,
) {
  const selected = activePatterns.filter((item) => content.includes(item.statement));
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

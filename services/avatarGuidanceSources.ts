import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { aiPrivacyToken, canAIReadEntry } from './aiPrivacy';
import { resolveAvatarSourceEvidence } from './avatarSourceEvidence';
import { selectAvatarOntologyContext } from './avatarOntologyContext';
import type { ActionItem, DiaryEntry, Principle } from '../types';
import type { FutureState } from '../types/future';
import type { CognitiveObject } from '../features/avatar/types';
import { readAvatarNameStatement } from './avatarMemoryPolicy';
import { goalProgress } from './futureRepository';
import type { GuidanceSource } from './avatarGuidance';
import { selectGuidanceResults } from './guidanceResults';
import { describeActionPractice } from './actionPracticeSemantics';
import { currentPrinciples, historicalEvolutionPrinciples } from './principleRevision';

/** Read-only context. Suggestions never become user commitments implicitly. */
export function buildGuidanceSources(input: {
  entries: DiaryEntry[];
  principles: Principle[];
  actions: ActionItem[];
  future?: FutureState;
  now?: number;
  includeExpiredHistory?: boolean;
  diagnostics?: import('./avatarOntologyContext').OntologyRetrievalDiagnostics;
  graph: AvatarOntologySnapshot;
}): GuidanceSource[] {
  const privacyToken = aiPrivacyToken(
    input.entries,
    input.future,
    input.actions,
    input.principles,
    input.graph,
  );
  const now = input.now ?? Date.now();
  const accessible = input.entries.filter((entry) => canAIReadEntry(entry, now));
  if (input.diagnostics) input.diagnostics.privacyCount += input.entries.length - accessible.length;
  const entries = new Map(accessible.map((entry) => [entry.id, entry]));
  const denied = (ids: string[]) => ids.some((id) => !entries.has(id));
  const sessions = input.graph.sessions ?? [];
  const eligible = selectAvatarOntologyContext(
    input.graph,
    input.entries,
    privacyToken,
    now,
    input.includeExpiredHistory,
    input.diagnostics,
  );
  const sourceEntryIds = (id: string) =>
    eligible
      .find(({ object }) => object.id === id)
      ?.evidence.filter(
        (edge) => edge.sourceKind === 'now_entry' || edge.sourceKind === 'past_experience',
      )
      .map((edge) => edge.toId) ?? [];
  const activeUnderstanding = eligible
    .filter(({ object }) => object.domain === 'my_understanding')
    .map(({ object }) => object);
  const validOrigin = (id: string) =>
    Object.values(input.future?.archiveOrigins ?? {})
      .filter((origin) => origin.id === id)
      .every(
        (origin) =>
          origin.sourceRefs.length > 0 &&
          resolveAvatarSourceEvidence(origin.sourceRefs, input.entries, sessions, now, privacyToken)
            .length === origin.sourceRefs.length,
      );
  // Propagate revoked/missing provenance through the complete dependency graph.
  // A cycle is harmless unless one of its sources is denied.
  const dependencies = new Map<string, string[]>();
  const key = (kind: string, id: string) => `${kind}:${id}`;
  input.entries.forEach((e) => dependencies.set(key('entry', e.id), []));
  activeUnderstanding.forEach((p) =>
    dependencies.set(
      key('pattern', p.id),
      sourceEntryIds(p.id).map((id) => key('entry', id)),
    ),
  );
  input.principles.forEach((p) =>
    dependencies.set(key('principle', p.id), [
      ...(p.derivedFromEntryIds ?? []).map((id) => key('entry', id)),
      ...(p.sourcePatternIds ?? []).map((id) => key('pattern', id)),
      ...(p.derivedFromPracticeIds ?? []).map((id) => key('practice', id)),
    ]),
  );
  input.actions.forEach((a) =>
    dependencies.set(key('action', a.id), [
      ...(a.evidenceEntryIds ?? []).map((id) => key('entry', id)),
      ...[a.sourceEntryId, a.resultEntryId].flatMap((id) => (id ? [key('entry', id)] : [])),
      ...(a.principleId ? [key('principle', a.principleId)] : []),
      ...(a.goalId ? [key('future', a.goalId)] : []),
    ]),
  );
  input.future?.practiceRecords?.forEach((r) =>
    dependencies.set(key('practice', r.id), [
      key('action', r.actionId),
      ...(r.pastEntryId ? [key('entry', r.pastEntryId)] : []),
    ]),
  );
  input.future?.visions.forEach((v) => dependencies.set(key('future', v.id), []));
  input.future?.goals.forEach((g) =>
    dependencies.set(key('future', g.id), g.visionId ? [key('future', g.visionId)] : []),
  );
  const blocked = new Set(
    input.entries.filter((e) => !canAIReadEntry(e, now)).map((e) => key('entry', e.id)),
  );
  input.principles
    .filter((p) => p.aiVisibility !== 'allowed')
    .forEach((p) => blocked.add(key('principle', p.id)));
  input.actions
    .filter((a) => a.aiVisibility !== 'allowed')
    .forEach((a) => blocked.add(key('action', a.id)));
  [...(input.future?.visions ?? []), ...(input.future?.goals ?? [])]
    .filter((v) => v.aiVisibility !== 'allowed')
    .forEach((v) => blocked.add(key('future', v.id)));
  for (const kind of ['action', 'future']) {
    for (const id of dependencies.keys())
      if (id.startsWith(`${kind}:`) && !validOrigin(id.slice(kind.length + 1))) blocked.add(id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, refs] of dependencies) {
      if (!blocked.has(id) && refs.some((ref) => !dependencies.has(ref) || blocked.has(ref))) {
        blocked.add(id);
        changed = true;
      }
    }
  }
  const permitted = (kind: string, id: string) =>
    dependencies.has(key(kind, id)) && !blocked.has(key(kind, id));
  const future = input.future
    ? {
        ...input.future,
        visions: input.future.visions.filter((v) => permitted('future', v.id)),
        goals: input.future.goals.filter((g) => permitted('future', g.id)),
        practiceRecords: input.future.practiceRecords?.filter((r) => permitted('practice', r.id)),
      }
    : undefined;
  const excerpt = (text: string) =>
    text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);
  const searchableExcerpt = (text: string) =>
    text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  const evidence = (ids: string[]) =>
    [...new Set(ids)]
      .flatMap((id) => {
        const entry = entries.get(id);
        return entry
          ? [
              {
                text: excerpt(`${entry.title}：${entry.content}`),
                searchText: searchableExcerpt(`${entry.title}：${entry.content}`),
                occurredAt: entry.createdAt,
                entryId: entry.id,
                source: 'entry' as const,
              },
            ]
          : [];
      })
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 3);
  const patterns = activeUnderstanding.filter((p) => permitted('pattern', p.id));
  const principles = currentPrinciples(input.principles).filter(
    (p) =>
      permitted('principle', p.id) &&
      (p.sourcePatternIds ?? []).every((id) => patterns.some((pattern) => pattern.id === id)) &&
      !denied([
        ...(p.derivedFromEntryIds ?? []),
        ...activeUnderstanding
          .filter((pattern) => p.sourcePatternIds?.includes(pattern.id))
          .flatMap((pattern) => sourceEntryIds(pattern.id)),
      ]),
  );
  const actions = input.actions.filter(
    (a) =>
      permitted('action', a.id) &&
      (!a.principleId || principles.some((p) => p.id === a.principleId)) &&
      !denied([
        ...(a.evidenceEntryIds ?? []),
        ...(a.sourceEntryId ? [a.sourceEntryId] : []),
        ...(a.resultEntryId ? [a.resultEntryId] : []),
      ]),
  );
  const validEvents = (future?.events ?? []).filter(
    (e) =>
      e.status === 'valid' &&
      permitted('future', e.goalId) &&
      !(e.sourceEntryId && denied([e.sourceEntryId])) &&
      !(e.sourceActionId && !actions.some((a) => a.id === e.sourceActionId)),
  );
  const practiceResults = (ids: string[]): NonNullable<GuidanceSource['results']> =>
    (future?.practiceRecords ?? [])
      .filter((record) => ids.includes(record.id))
      .map((record) => ({
        // An empty note is deliberately represented as an empty description: status is evidence,
        // but it is not evidence that the action produced a useful result.
        text: excerpt(describeActionPractice(record)),
        occurredOn: record.occurredOn,
        createdAt: record.createdAt,
        status: record.status,
      }));
  const actionResults = (id: string): NonNullable<GuidanceSource['results']> => {
    // Goal-linked outcomes and independent practice are two views of explicit user feedback.
    const eventResults = validEvents
      .filter((e) => e.sourceActionId === id && e.actionFeedback)
      .map((e) => ({
        text: excerpt(describeActionPractice(e.actionFeedback!)),
        occurredOn: e.occurredOn,
        createdAt: e.createdAt,
        status: e.actionFeedback!.status,
      }));
    const practices = (future?.practiceRecords ?? [])
      .filter((r) => r.actionId === id)
      .map((r) => ({
        text: excerpt(describeActionPractice(r)),
        occurredOn: r.occurredOn,
        createdAt: r.createdAt,
        status: r.status,
      }));
    return [...eventResults, ...practices]
      .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt - a.createdAt)
      .filter(
        (result, index, all) =>
          all.findIndex(
            (other) =>
              other.text === result.text &&
              other.occurredOn === result.occurredOn &&
              other.status === result.status,
          ) === index,
      )
      .slice(0, 3)
      .map(({ text, occurredOn, status }) => ({ text, occurredOn, status }));
  };
  const kindOfCognition = (object: CognitiveObject): GuidanceSource['kind'] => {
    if (object.category === 'preferences_boundaries') return '偏好';
    if (object.category === 'values_motivation') return '驱动';
    return '背景';
  };
  const cognitionEvidence = (id: string): NonNullable<GuidanceSource['evidence']> =>
    [
      ...evidence(sourceEntryIds(id)),
      ...(eligible.find(({ object }) => object.id === id)?.evidence ?? [])
        .filter((edge) => edge.sourceKind === 'chat_user_message')
        .map((edge) => ({
          text: excerpt(edge.verbatimQuote),
          occurredAt: Date.parse(edge.sourceOccurredAt),
          source: 'message' as const,
        })),
    ].slice(0, 3);
  const sources: GuidanceSource[] = [
    ...patterns.map((p) => ({
      id: p.id,
      kind: '模式' as const,
      text: p.statement,
      module: 'past' as const,
      nature: 'inferred' as const,
      status: p.status,
      temporalStatus: 'current_understanding' as const,
      validFrom: Date.parse(p.validity.validFrom),
      validTo: p.validity.validUntil ? Date.parse(p.validity.validUntil) : undefined,
      detail: p.notes,
      evidence: cognitionEvidence(p.id),
    })),
    ...principles.map((p) => ({
      id: p.id,
      kind: '原则' as const,
      text: p.text,
      module: 'past' as const,
      relatedKeys: (p.sourcePatternIds ?? []).map((id) => `模式:${id}`),
      nature: 'explicit' as const,
      temporalStatus: 'current_understanding' as const,
      detail: p.application
        ? `适用情境：${p.application.trigger}；尝试方式：${p.application.action}${p.application.exception ? `；不适用情况：${p.application.exception}` : ''}`
        : undefined,
      evidence: evidence([
        ...(p.derivedFromEntryIds ?? []),
        ...patterns
          .filter((pattern) => p.sourcePatternIds?.includes(pattern.id))
          .flatMap((pattern) => sourceEntryIds(pattern.id)),
      ]),
      results: selectGuidanceResults(
        [
          ...accessible.flatMap((entry) =>
            (entry.principleFeedback ?? [])
              .filter(
                (f) =>
                  f.principleId === p.id &&
                  Number.isFinite(f.createdAt) &&
                  f.createdAt >= 0 &&
                  f.createdAt <= 8.64e15,
              )
              .map((f) => ({
                text: excerpt(`${entry.title}：${entry.content}`),
                occurredOn: new Date(f.createdAt).toISOString().slice(0, 10),
                status: f.outcome,
              })),
          ),
          ...actions.filter((a) => a.principleId === p.id).flatMap((a) => actionResults(a.id)),
          ...practiceResults(p.derivedFromPracticeIds ?? []),
        ]
          .filter(
            (result, index, all) =>
              all.findIndex(
                (other) =>
                  other.text === result.text &&
                  other.occurredOn === result.occurredOn &&
                  other.status === result.status,
              ) === index,
          )
          .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
          .map(({ text, occurredOn, status }) => ({ text, occurredOn, status })),
      ),
    })),
    ...historicalEvolutionPrinciples(input.principles)
      .filter(
        ({ principle }) =>
          permitted('principle', principle.id) &&
          (principle.sourcePatternIds ?? []).every((id) =>
            patterns.some((pattern) => pattern.id === id),
          ) &&
          !denied([
            ...(principle.derivedFromEntryIds ?? []),
            ...activeUnderstanding
              .filter((pattern) => principle.sourcePatternIds?.includes(pattern.id))
              .flatMap((pattern) => sourceEntryIds(pattern.id)),
          ]),
      )
      .map(({ principle, successor }) => ({
        id: `${principle.id}:historical`,
        kind: '背景' as const,
        text: principle.text,
        module: 'past' as const,
        nature: 'explicit' as const,
        temporalStatus: 'historical_understanding' as const,
        validFrom: principle.createdAt,
        validTo: successor.revisedAt ?? successor.createdAt,
        detail: `过去的判断；在 ${new Date(successor.revisedAt ?? successor.createdAt).toLocaleDateString('zh-CN')} 后已发生变化，不作为当前原则`,
        evidence: evidence(principle.derivedFromEntryIds ?? []),
      })),
    ...actions
      .filter(
        (a) =>
          (a.status === 'active' || a.status === 'pending' || actionResults(a.id).length > 0) &&
          (a.status === 'completed' ||
            a.status === 'abandoned' ||
            !a.goalId ||
            future?.goals.some((g) => g.id === a.goalId && g.status === 'active')),
      )
      .map((a) => ({
        id: a.id,
        sourceKey: `行动:${a.id}`,
        kind:
          a.status === 'completed' || a.status === 'abandoned'
            ? ('背景' as const)
            : ('行动' as const),
        text: a.title,
        module: 'now' as const,
        status: a.status,
        temporalStatus:
          a.status === 'completed' || a.status === 'abandoned'
            ? ('historical_fact' as const)
            : a.scheduledOn
              ? ('time_limited' as const)
              : ('current_understanding' as const),
        detail:
          [a.scheduledOn && `安排于 ${a.scheduledOn}`, a.question, a.rationale]
            .filter(Boolean)
            .map((v) => excerpt(v!))
            .join('；') || undefined,
        evidence: evidence([
          ...(a.evidenceEntryIds ?? []),
          ...(a.sourceEntryId ? [a.sourceEntryId] : []),
          ...(a.resultEntryId ? [a.resultEntryId] : []),
        ]),
        results: actionResults(a.id),
        relatedKeys: [
          a.goalId ? `目标:${a.goalId}` : '',
          a.principleId ? `原则:${a.principleId}` : '',
        ].filter(Boolean),
      })),
    ...(future?.visions ?? []).map((v) => ({
      id: v.id,
      sourceKey: `愿景:${v.id}`,
      kind: v.status === 'active' ? ('愿景' as const) : ('背景' as const),
      text: v.text,
      status: v.status,
      temporalStatus:
        v.status === 'active'
          ? ('current_understanding' as const)
          : ('historical_understanding' as const),
      detail: v.status === 'active' ? undefined : `历史愿景：${v.status}，不作为当前义务`,
      module: 'future' as const,
    })),
    ...(future?.goals ?? []).map((g) => ({
      id: g.id,
      sourceKey: `目标:${g.id}`,
      kind: g.status === 'active' ? ('目标' as const) : ('背景' as const),
      status: g.status,
      text: g.title,
      module: 'future' as const,
      relatedKeys: g.visionId ? [`愿景:${g.visionId}`] : [],
      temporalStatus:
        g.status === 'active'
          ? ('current_understanding' as const)
          : ('historical_understanding' as const),
      results: validEvents
        .filter((e) => e.goalId === g.id)
        .map((e) => ({
          text:
            e.value.kind === 'narrative'
              ? excerpt(e.value.note)
              : `用户确认的进展：${e.value.amount} ${g.measurement.kind === 'quantity' ? g.measurement.unit : ''}`,
          occurredOn: e.occurredOn,
          status: e.actionFeedback?.status ?? 'progress',
        }))
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
        .slice(0, 3),
      detail:
        g.status !== 'active'
          ? `历史目标：${g.status}，不作为当前义务`
          : g.measurement.kind === 'quantity' && future
            ? `${goalProgress({ ...future, events: validEvents }, g).total} / ${g.measurement.target} ${g.measurement.unit}`
            : undefined,
    })),
    ...eligible
      .filter(({ object }) => object.domain === 'about_me')
      .map(({ object }) => ({
        id: object.id,
        kind: kindOfCognition(object),
        text: object.statement,
        nature: 'explicit' as const,
        status: object.status,
        temporalStatus:
          object.validity.mode === 'staged'
            ? ('time_limited' as const)
            : ('current_understanding' as const),
        evidence: cognitionEvidence(object.id),
        validFrom: Date.parse(object.validity.validFrom),
        validTo: object.validity.validUntil ? Date.parse(object.validity.validUntil) : undefined,
        confirmedAt: object.confirmedAt ? Date.parse(object.confirmedAt) : undefined,
        avatarName: readAvatarNameStatement(object.statement) ?? undefined,
        module: sourceEntryIds(object.id).length ? ('past' as const) : ('now' as const),
        detail: object.notes,
      })),
    ...accessible.map((entry) => ({
      id: `entry:${entry.id}`,
      kind: '背景' as const,
      text: excerpt(`${entry.title}：${entry.content}`),
      nature: 'experience' as const,
      status: 'historical-record',
      temporalStatus: 'historical_fact' as const,
      module: 'past' as const,
      evidence: evidence([entry.id]),
    })),
  ];
  return sources
    .filter((source) => source.text.trim())
    .map((source) => ({
      ...source,
      domain: input.graph.objects.find((object) => object.id === source.id)?.domain,
      guardrail: input.graph.objects.find((object) => object.id === source.id)?.guardrail,
      ...(source.status === 'archived_expired'
        ? {
            temporalStatus: 'historical_understanding' as const,
            detail: `历史轨迹（阶段状态已到期）：${source.detail ?? source.text}`,
          }
        : {}),
      tags: [
        ...new Set([
          ...(source.id.startsWith('entry:') ? (entries.get(source.id.slice(6))?.tags ?? []) : []),
          ...input.graph.edges
            .filter((edge) => edge.type === 'SCOPED_IN' && edge.fromId === source.id)
            .map((edge) => (edge.type === 'SCOPED_IN' ? edge.tagLabel : '')),
        ]),
      ],
      aiPrivacyToken: privacyToken,
      text: source.text.slice(0, 4000),
      detail: source.detail?.slice(0, 2400),
    }));
}

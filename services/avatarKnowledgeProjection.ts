import { atomicMemoryFromUnderstanding } from './avatarMemory';
import type {
  AvatarAtomicMemory,
  AvatarMemoryFacet,
  AvatarMemoryRelation,
  AvatarMemorySourceRef,
  AvatarMemoryStatus,
  AvatarUnderstandingVersion,
} from '../features/avatar/types';
import type { ActionItem, DiaryEntry, Principle } from '../types';
import type { FutureState, Goal, Measurement, Vision } from '../types/future';

const stableId = (prefix: string, parts: Array<string | number | undefined>): string => {
  const input = parts.filter((part) => part !== undefined && part !== '').join('|');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
};

const unique = <T>(items: T[]): T[] => [...new Set(items)];

const textIncludesAny = (text: string, words: string[]) =>
  words.some((word) => text.toLocaleLowerCase().includes(word.toLocaleLowerCase()));

const measurementSummary = (measurement: Measurement) =>
  measurement.kind === 'quantity' ? `目标 ${measurement.target}${measurement.unit}` : '叙事型进展';

const activeOrRetainedStatus = (status: string): AvatarMemoryStatus | null => {
  if (status === 'active') return 'confirmed';
  if (status === 'paused' || status === 'completed' || status === 'ended') return 'retained';
  return null;
};

const relation = (
  fromId: string,
  toId: string,
  kind: AvatarMemoryRelation['kind'],
  reason: string,
  sourceRefs: AvatarMemorySourceRef[],
): AvatarMemoryRelation => ({
  id: stableId('avatar_relation', [fromId, toId, kind]),
  fromId,
  toId,
  kind,
  confidence: 0.9,
  reason,
  sourceRefs,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const avatarMemoryIdForPrinciple = (id: string) => stableId('avatar_principle', [id]);
export const avatarMemoryIdForVision = (id: string) => stableId('avatar_vision', [id]);
export const avatarMemoryIdForGoal = (id: string) => stableId('avatar_goal', [id]);
export const avatarMemoryIdForAction = (id: string) => stableId('avatar_action', [id]);

export function projectPrincipleToAvatarMemory(principle: Principle): AvatarAtomicMemory[] {
  const text = principle.text.trim();
  if (!text) return [];
  const tags = principle.tags ?? [];
  const joined = `${text} ${tags.join(' ')}`;
  const facets: AvatarMemoryFacet[] = ['value'];
  if (textIncludesAny(joined, ['边界', '底线', '拒绝', '不再', '停止', '不能', '保护']))
    facets.push('boundary');
  if (principle.application?.trigger || principle.application?.action) facets.push('motivation');

  return [
    {
      id: avatarMemoryIdForPrinciple(principle.id),
      statement: `用户确立过一条原则：${text}`,
      nature: 'commitment',
      category: 'judgment',
      facets: unique(facets),
      tags: unique(tags),
      contexts: unique(
        [...tags, principle.application?.trigger ?? '', principle.application?.action ?? ''].filter(
          Boolean,
        ),
      ),
      sourceRefs: [
        { source: 'principle', id: principle.id, excerpt: text, createdAt: principle.createdAt },
        ...(principle.derivedFromEntryIds ?? []).map((id) => ({ source: 'entry' as const, id })),
        ...(principle.sourcePatternIds ?? []).map((id) => ({ source: 'pattern' as const, id })),
      ],
      confidence: principle.confidence ?? 0.82,
      status: 'confirmed',
      sensitivity: 'normal',
      validFrom: principle.createdAt,
      createdAt: principle.createdAt,
      updatedAt: principle.createdAt,
      confirmedAt: principle.createdAt,
      confirmedBy: 'user',
    },
  ];
}

export function projectVisionToAvatarMemory(vision: Vision): AvatarAtomicMemory[] {
  const text = vision.text.trim();
  const status = activeOrRetainedStatus(vision.status);
  if (!text || !status || vision.status === 'archived') return [];
  return [
    {
      id: avatarMemoryIdForVision(vision.id),
      statement: `用户正在靠近的愿景：${text}`,
      nature: 'explicit',
      category: 'goals',
      facets: ['aspirational_self', 'motivation'],
      tags: ['未来愿景'],
      contexts: ['未来愿景'],
      sourceRefs: [{ source: 'future', id: vision.id, excerpt: text, createdAt: vision.createdAt }],
      confidence: 0.9,
      status,
      sensitivity: 'normal',
      validFrom: vision.createdAt,
      createdAt: vision.createdAt,
      updatedAt: vision.updatedAt,
      confirmedAt: vision.createdAt,
      confirmedBy: 'user',
    },
  ];
}

export function projectGoalToAvatarMemory(goal: Goal, vision?: Vision): AvatarAtomicMemory[] {
  const title = goal.title.trim();
  const status = activeOrRetainedStatus(goal.status);
  if (!title || !status) return [];
  return [
    {
      id: avatarMemoryIdForGoal(goal.id),
      statement: `用户的目标（${{ active: '进行中', paused: '已暂停', completed: '已完成', ended: '已结束' }[goal.status]}）：${title}`,
      nature: 'commitment',
      category: 'goals',
      facets: ['motivation', 'aspirational_self'],
      tags: unique(goal.tags),
      contexts: unique(
        [
          ...goal.tags,
          measurementSummary(goal.measurement),
          goal.dueDate ? `截至 ${goal.dueDate}` : '',
          vision?.text ? `服务愿景：${vision.text}` : '',
        ].filter(Boolean),
      ),
      sourceRefs: [{ source: 'future', id: goal.id, excerpt: title, createdAt: goal.createdAt }],
      confidence: goal.status === 'active' ? 0.88 : 0.76,
      status,
      sensitivity: 'normal',
      validFrom: goal.createdAt,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      confirmedAt: goal.createdAt,
      confirmedBy: 'user',
    },
  ];
}

export function projectActionToAvatarMemory(action: ActionItem): AvatarAtomicMemory[] {
  const title = action.title.trim();
  if (!title || action.status === 'abandoned') return [];
  return [
    {
      id: avatarMemoryIdForAction(action.id),
      statement: `用户的行动（${{ pending: '待开始', active: '进行中', completed: '已完成' }[action.status]}）：${title}`,
      nature: action.status === 'completed' ? 'state' : 'commitment',
      category: 'goals',
      facets: ['motivation'],
      tags: unique(
        [action.goalId ? '关联目标' : '', action.principleId ? '关联原则' : ''].filter(Boolean),
      ),
      contexts: unique(
        [
          action.scheduledOn ? `安排于 ${action.scheduledOn}` : '',
          action.question ?? '',
          action.rationale ?? '',
        ].filter(Boolean),
      ),
      sourceRefs: [
        { source: 'action', id: action.id, excerpt: title, createdAt: action.createdAt },
        ...(action.goalId ? [{ source: 'future' as const, id: action.goalId }] : []),
        ...(action.principleId ? [{ source: 'principle' as const, id: action.principleId }] : []),
      ],
      confidence: action.status === 'completed' ? 0.72 : 0.82,
      status: action.status === 'completed' ? 'retained' : 'confirmed',
      sensitivity: 'normal',
      validFrom: action.createdAt,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
      confirmedAt: action.createdAt,
      confirmedBy: 'user',
    },
  ];
}

export function projectFutureStateToAvatarMemories(
  state: FutureState,
  actions: ActionItem[] = [],
): AvatarAtomicMemory[] {
  const visionsById = new Map(state.visions.map((vision) => [vision.id, vision]));
  return [
    ...state.visions.flatMap(projectVisionToAvatarMemory),
    ...state.goals.flatMap((goal) =>
      projectGoalToAvatarMemory(goal, visionsById.get(goal.visionId ?? '')),
    ),
    ...actions.flatMap(projectActionToAvatarMemory),
  ];
}

export function projectFutureRelations(
  state: FutureState,
  actions: ActionItem[] = [],
): AvatarMemoryRelation[] {
  const goalsById = new Map(state.goals.map((goal) => [goal.id, goal]));
  const relations: AvatarMemoryRelation[] = [];

  for (const goal of state.goals) {
    if (
      !goal.visionId ||
      !state.visions.some((v) => v.id === goal.visionId && v.status !== 'archived')
    )
      continue;
    const goalMemory = avatarMemoryIdForGoal(goal.id);
    const visionMemory = avatarMemoryIdForVision(goal.visionId);
    relations.push(
      relation(goalMemory, visionMemory, 'serves', '目标由用户明确关联到该愿景', [
        { source: 'future', id: goal.id, excerpt: goal.title },
        { source: 'future', id: goal.visionId },
      ]),
    );
  }

  for (const action of actions) {
    if (action.status === 'abandoned') continue;
    const actionMemory = avatarMemoryIdForAction(action.id);
    if (action.goalId && goalsById.has(action.goalId)) {
      relations.push(
        relation(
          actionMemory,
          avatarMemoryIdForGoal(action.goalId),
          'serves',
          '行动由用户明确关联到该目标',
          [
            { source: 'action', id: action.id, excerpt: action.title },
            { source: 'future', id: action.goalId },
          ],
        ),
      );
    }
    if (action.principleId) {
      relations.push(
        relation(
          actionMemory,
          avatarMemoryIdForPrinciple(action.principleId),
          'constrains',
          '行动引用了用户确立的原则',
          [
            { source: 'action', id: action.id, excerpt: action.title },
            { source: 'principle', id: action.principleId },
          ],
        ),
      );
    }
  }

  return relations;
}

/** Legacy generated copies are identified by reserved IDs, never by matching user text. */
export const isCanonicalAvatarProjection = (memory: AvatarAtomicMemory): boolean =>
  /^(avatar_(entry|principle|vision|goal|action)_|atomic_pattern_)/.test(memory.id);

/** Rebuildable view: canonical objects stay in their owning repository. */
export function resolveAvatarKnowledge(input: {
  memories: AvatarAtomicMemory[];
  principles: Principle[];
  actions: ActionItem[];
  future?: FutureState;
  relations?: AvatarMemoryRelation[];
  patterns?: AvatarUnderstandingVersion[];
  entries?: DiaryEntry[];
}) {
  const memories = [
    ...input.memories.filter(
      (memory) =>
        !isCanonicalAvatarProjection(memory) &&
        !Object.hasOwn(input.future?.archiveOrigins ?? {}, memory.id),
    ),
    ...(input.patterns ?? [])
      .filter((p) => p.status === 'confirmed')
      .map(atomicMemoryFromUnderstanding),
    ...(input.entries ?? [])
      .filter(
        (entry) =>
          !entry.isSample &&
          !entry.isLocked &&
          !entry.isEncrypted &&
          (!entry.unlockAt || entry.unlockAt <= Date.now()),
      )
      .map(
        (entry): AvatarAtomicMemory => ({
          id: stableId('avatar_entry', [entry.id]),
          statement: entry.content,
          category: 'experience',
          nature: 'experience',
          facets: ['domain_background'],
          tags: entry.tags,
          contexts: [],
          sourceRefs: [
            { source: 'entry', id: entry.id, excerpt: entry.title, createdAt: entry.createdAt },
            ...(entry.relatedActionIds ?? []).map((id) => ({ source: 'action' as const, id })),
            ...(entry.relatedPrincipleIds ?? []).map((id) => ({
              source: 'principle' as const,
              id,
            })),
          ],
          status: 'confirmed',
          confidence: 1,
          sensitivity: 'normal',
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          confirmedBy: 'user',
        }),
      ),
    ...input.principles.flatMap(projectPrincipleToAvatarMemory),
    ...(input.future
      ? projectFutureStateToAvatarMemories(input.future, input.actions)
      : input.actions.flatMap(projectActionToAvatarMemory)),
  ];
  for (const origin of Object.values(input.future?.archiveOrigins ?? {})) {
    const memory = memories.find(
      (m) =>
        m.sourceRefs[0]?.id === origin.id &&
        m.sourceRefs[0]?.source === (origin.kind === 'action' ? 'action' : 'future'),
    );
    if (memory)
      memory.sourceRefs.push(
        ...origin.sourceRefs.filter(
          (ref) =>
            !memory.sourceRefs.some(
              (existing) => existing.source === ref.source && existing.id === ref.id,
            ),
        ),
      );
  }
  const ids = new Set(memories.map((memory) => memory.id));
  const generated = input.future ? projectFutureRelations(input.future, input.actions) : [];
  // First source reference identifies a generated record's canonical owner.
  const owners = new Map(
    memories.filter(isCanonicalAvatarProjection).flatMap((memory) => {
      const owner = memory.sourceRefs[0];
      return owner ? [[`${owner.source}:${owner.id}`, memory.id] as const] : [];
    }),
  );
  for (const memory of memories) {
    for (const ref of memory.sourceRefs) {
      const ownerId = owners.get(`${ref.source}:${ref.id}`);
      if (
        !ownerId ||
        ownerId === memory.id ||
        generated.some((r) => r.fromId === memory.id && r.toId === ownerId)
      )
        continue;
      generated.push(relation(memory.id, ownerId, 'supports', '通过已保存的来源编号关联', [ref]));
    }
  }
  const relations = [
    ...(input.relations ?? []).filter((r) => !r.id.startsWith('avatar_relation_')),
    ...generated,
  ].filter((r) => ids.has(r.fromId) && ids.has(r.toId));
  return { memories, relations };
}

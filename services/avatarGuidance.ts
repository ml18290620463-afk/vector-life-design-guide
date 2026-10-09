import type { AvatarAtomicMemory } from '../features/avatar/types';
export { buildGuidanceSources } from './avatarGuidanceSources';

export interface GuidanceSource {
  id: string;
  kind: '模式' | '原则' | '行动' | '愿景' | '目标' | '偏好' | '边界' | '驱动' | '触点' | '背景';
  text: string;
  module: 'past' | 'now' | 'future';
  relatedKeys?: string[];
  sourceKey?: string;
  /** Local-only full text for matching; never exposed to the avatar response. */
  searchText?: string;
  detail?: string;
  status?: string;
  /** `searchText` stays inside local retrieval and is removed before a source reaches the avatar. */
  evidence?: { text: string; occurredAt: number; searchText?: string }[];
  results?: { text: string; occurredOn: string; status: string }[];
  nature?: AvatarAtomicMemory['nature'];
  validFrom?: number;
  validTo?: number;
  avatarName?: string;
  confirmedAt?: number;
}

export interface GuidanceRetrievalOptions {
  range?: { start: number; end: number };
  preferredSourceIds?: string[];
}

export const GUIDANCE_STARTERS = ['回看我的惯性', '想清眼前的选择', '让今天靠近我的愿景'];
const keyOf = (source: GuidanceSource) => source.sourceKey ?? `${source.kind}:${source.id}`;

const normalizeForRetrieval = (text: string) => text.replace(/\s+/g, '').toLowerCase();

const queryBigrams = (text: string) => {
  const compact = normalizeForRetrieval(text);
  return Array.from(
    new Set(
      Array.from({ length: Math.max(0, compact.length - 1) }, (_, i) => compact.slice(i, i + 2)),
    ),
  );
};

/**
 * Keep the context sent to the avatar small, while showing the part of a long record
 * that actually matched the current question instead of always its opening paragraph.
 */
const focusedExcerpt = (text: string, question: string, max = 700) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  // `\w` is ASCII-oriented in JavaScript, so using it here accidentally drops
  // Chinese query terms. Keep every meaningful letter/number bigram instead.
  const terms = queryBigrams(question).filter((term) => /[\p{L}\p{N}]/u.test(term));
  let bestIndex = -1;
  let bestLength = 0;
  for (const term of terms) {
    const index = clean.toLowerCase().indexOf(term);
    if (index >= 0 && term.length > bestLength) {
      bestIndex = index;
      bestLength = term.length;
    }
  }
  if (bestIndex < 0) return clean.slice(0, max);
  const start = Math.max(0, bestIndex - Math.floor(max * 0.34));
  const end = Math.min(clean.length, start + max);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
};

const prepareSelectedSources = (selected: GuidanceSource[], question: string): GuidanceSource[] =>
  selected.map(({ searchText: _searchText, evidence, ...source }) => ({
    ...source,
    evidence: evidence?.map(({ searchText, text, ...item }) => ({
      ...item,
      text: focusedExcerpt(searchText ?? text, question),
    })),
  }));
const compactSourceText = (text: string, max = 32) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

const naturalSourceLine = (source: GuidanceSource) => {
  const text = compactSourceText(source.text);
  if (source.nature === 'inferred')
    return `这是一条经你确认、仍需验证的理解，不一定适用于这次：${text}`;
  if (source.nature === 'state') return `你曾记录过这样的状态，不能据此判断你现在的感受：${text}`;
  if (source.nature === 'commitment') return `你曾表达过这个计划，是否完成还需要核实：${text}`;
  switch (source.kind) {
    case '模式':
      return `这可能与之前归纳的模式有关，不一定适用于这次：${text}`;
    case '原则':
      return `这能接到你之前定下的一条原则：${text}`;
    case '行动':
      return `眼前已经有个相关动作：${text}${source.detail ? `（${source.detail}）` : ''}`;
    case '愿景':
      return `它背后连着你想靠近的方向：${text}`;
    case '目标':
      return `它和你正在推进的目标有关：${text}${source.detail ? `（${source.detail}）` : ''}`;
    case '偏好':
      return `我记得你更偏向：${text}`;
    case '边界':
      return `这里可能碰到你在意的边界：${text}`;
    case '驱动':
      return `这里有一条比较核心的驱动：${text}`;
    case '触点':
      return `这件事可能碰到了一个情绪触点：${text}`;
    default:
      return `你之前留下的背景是：${text}`;
  }
};

const naturalStarterReply = (question: string) => {
  if (question === GUIDANCE_STARTERS[0])
    return '好，我们先不急着评价它。你可以说一件最近反复出现的事，我会帮你看它更像思维模式、行为模式，还是关系里的反应。';
  if (question === GUIDANCE_STARTERS[1])
    return '可以。你先把眼前的选择说出来，不需要整理得很完整。我会陪你看限制、代价，以及你真正想守住的东西。';
  if (question === GUIDANCE_STARTERS[2])
    return '好，我们先看眼前处境和长期方向是否一致，也可以讨论这个目标是否仍适合你。';
  return undefined;
};

const stripPunctuation = (text: string) => text.replace(/[？?！!。.,，、\s]/g, '').toLowerCase();

const stripModalParticles = (text: string) =>
  stripPunctuation(text).replace(/[呢啊呀吗吧啦哦喔哈哇诶哎呗]+$/g, '');

/** Only short acknowledgements/deictic follow-ups reuse a prior topic. */
export const isAvatarContextContinuation = (question: string) =>
  /^(继续|继续说|可以|嗯|好|好的|对|是的|那怎么办|这怎么办|那怎么做|那为什么|为什么|然后|具体解释一下|换个思路|换个方案|还有|这次|那条)$/.test(
    stripModalParticles(question),
  );

const isAvatarDirectedComplaint = (question: string) =>
  /(胡说|瞎说|乱说|机械|答非所问|没用|不满意|不是这个|重复|生气|离谱)/.test(question) ||
  /(?:我)?(?:讨厌|烦|受不了|不喜欢|恨|服了|被气到)(?:你|这个分身)/.test(question) ||
  /你(?:太|真|真的|怎么)?(?:烦|烂|差劲|蠢|傻|笨|冷冰冰|机械|没用|无聊|废话|敷衍|离谱)/.test(
    question,
  );

type AvatarConversationIntent =
  | 'identity'
  | 'name_avatar'
  | 'capability'
  | 'advice'
  | 'emotion'
  | 'action'
  | 'memory_control'
  | 'smalltalk'
  | 'complaint'
  | 'unknown';

export const detectAvatarConversationIntent = (question: string): AvatarConversationIntent => {
  const compact = stripModalParticles(question);
  if (/^(你叫什?么名字|你叫什么|你是谁|你叫啥|你有名字)$/.test(compact)) return 'identity';
  if (extractAvatarName(question)) return 'name_avatar';
  if (
    /^(你能做什么|你可以做什么|你会做什么|你有什么用|你能帮我什么|你可以帮我什么|你能陪我做什么|你能怎么帮我|你能干什么|你可以干什么|你会干什么|你是干什么的|你能干嘛|你可以干嘛|你会干嘛)$/.test(
      compact,
    )
  )
    return 'capability';
  if (isAvatarDirectedComplaint(question)) return 'complaint';
  if (
    /(怎么办|怎么做|怎么用|给我建议|你建议|帮我分析|帮我想|如何|应该不应该|要不要)/.test(question)
  )
    return 'advice';
  if (/(难受|崩溃|焦虑|害怕|委屈|生气|烦|很累|心慌|失落|痛苦|撑不住|不知道为什么)/.test(question))
    return 'emotion';
  if (/(记住|记下来|不要记|忘掉|删除记忆|别记)/.test(question)) return 'memory_control';
  if (extractActionWish(question)) return 'action';
  if (/^(你好|在|在吗|早|早安|晚安|谢谢|谢了|哈喽|hello|hi)$/.test(compact)) return 'smalltalk';
  return 'unknown';
};

export const extractAvatarName = (question: string) => {
  if (/你叫什?么|你叫什么|你叫啥|你有名字吗/.test(question)) return null;
  const match = question.match(
    /(?:我(?:想|希望)?(?:叫你|称呼你)|以后(?:叫你|称呼你)|你(?:就)?叫|你的名字(?:是|叫))\s*[「“"]?([^」”"\n，。！？!?]{1,12})[」”"]?/,
  );
  const name = match?.[1]?.trim();
  if (!name) return null;
  if (/^(什么|多少|谁|吗|呢|吧)$/.test(name)) return null;
  return name;
};

const extractActionWish = (question: string) => {
  const match = question.match(/(?:我)?(?:想|准备|打算|决定|要|希望|计划)\s*([^，。！？!?]{2,28})/);
  const action = match?.[1]?.trim();
  if (!action) return null;
  if (/^(知道|了解|问问|看看|想想|聊聊)/.test(action)) return null;
  return action;
};

export const buildNaturalAvatarReply = (
  question: string,
  selected: GuidanceSource[],
  previousQuestion?: string,
  identitySources: GuidanceSource[] = selected,
) => {
  const intent = detectAvatarConversationIntent(question);
  if (intent === 'identity') {
    const names = identitySources
      .filter((source) => source.avatarName)
      .sort((a, b) => (b.confirmedAt ?? 0) - (a.confirmedAt ?? 0));
    const latest = names[0];
    if (
      latest &&
      names.some(
        (source) =>
          source.confirmedAt === latest.confirmedAt && source.avatarName !== latest.avatarName,
      )
    )
      return '我找到同一时间确认的不同称呼，需要你重新确认要使用哪一个。';
    return latest
      ? `我是你的分身「${latest.avatarName}」。这是你确认保存的称呼。`
      : '我是你的分身，还没有可用的已确认称呼。你可以给我取一个名字，确认后我会保存。';
  }

  const avatarName = extractAvatarName(question);
  if (intent === 'name_avatar' && avatarName)
    return `你想叫我「${avatarName}」。我已整理为候选，请在下方确认保存，也可以先修改。`;

  if (intent === 'capability')
    return '我可以听你说，也可以陪你把一团乱的想法慢慢理清楚。\n\n你想聊天，我就像朋友一样陪你；你想要建议，我会认真帮你拆；你准备行动时，我会帮你把下一步想清楚，但不会替你擅自决定。';

  const action = extractActionWish(question);
  if (intent === 'action' && action)
    return `我听见了，你想${action}。\n\n我先不替你直接安排。你要不要把它确认成接下来的一步？确认后，我们再把它放到合适的位置。`;

  if (intent === 'advice')
    return selected[0]
      ? undefined
      : '可以，我先帮你一起想。\n\n你现在更需要我陪你梳理情绪，还是直接给你几个可执行的选择？';

  if (intent === 'emotion')
    return selected[0]
      ? undefined
      : '我在。你先不用急着解决它。\n\n你可以直接说最卡住的那一小段，我先陪你把感觉接住，再看要不要往建议走。';

  if (intent === 'memory_control')
    return /不要记|别记|忘掉|删除记忆/.test(question)
      ? '这次聊天不会自动写入正式记忆。如果要删除已保存的内容，请在对应记录中操作；我还没有执行删除。'
      : '可以。你把想留下的那句话直接说出来，我会先向你确认，再把它记住。';

  if (intent === 'smalltalk') {
    const compact = stripPunctuation(question);
    if (/^(谢谢|谢了)$/.test(compact)) return '嗯，我收到。你继续说就好，我在。';
    if (/^(晚安)$/.test(compact)) return '晚安。今天就先放下吧，剩下的我们明天再慢慢接。';
    if (/^(早|早安)$/.test(compact))
      return '早。我在。今天先不用急着整理，你想闲聊、复盘，还是先处理一件具体的事？';
    if (/^(在|在吗)$/.test(compact))
      return '在。我先跟着你的节奏来：你可以随便说一句，也可以把最卡住的事丢给我。';
    return '你好，我在。先不用把话整理成问题，你可以直接从一句话开始。';
  }

  if (intent === 'complaint') {
    if (
      /(?:我)?(?:讨厌|烦|受不了|不喜欢|恨)(?:你|这个分身)|你(?:太|真|真的|怎么)?(?:烦|烂|差劲|蠢|傻|笨|冷冰冰|敷衍)/.test(
        question,
      )
    )
      return `我接住了：你不是在给我补资料，你是在表达对我的不满。

这句话我不会当成“用户长期讨厌分身”的记忆保存，也不会反过来要求你解释。眼前更重要的是把互动改回来：我刚才应该先回应你的情绪，再承认哪里没接住，而不是冷冰冰地说信息不足。

你可以直接骂我一句也行，我会把它当成校准信号：少套模板，先听懂你现在到底卡在哪里。`;

    return `你说得对，刚才那样回很像在套模板，没有真正接住你。

我需要把边界说清楚：你没告诉过我的个人事实，我不能装作知道；但我可以基于你当下这句话，继续陪你判断、给选项、一起试。你直接说眼前的问题，我这次按当前语境回应。`;
  }

  const compact = stripPunctuation(question);
  const continuesPrevious = isAvatarContextContinuation(question) && previousQuestion;

  if (!selected.length && !continuesPrevious) {
    if (/(晚饭|晚上|今晚|今天晚上).*(吃什么|吃啥)|吃什么|吃啥/.test(compact))
      return `我确实不知道你今晚家里有什么、胃口怎样，所以不能装作知道答案。

但这类问题可以先别想“最正确”，只按负担选：
1. 想省事：面、粥、饺子、外卖固定店。
2. 想舒服：热汤、米饭配一个清淡菜。
3. 想奖励自己：选一个你最近惦记但没吃的。

如果你现在很烦，我会建议先选“省事且热的”，别把晚饭也变成一道考试题。`;

    if (/不知道/.test(question))
      return `我不知道你的真实答案，也不会硬编。

但你现在说“不知道”，通常已经够我们往前走一步了：先别问自己想要什么，先排除最不想要的那个选项。你把两个或三个备选丢给我，我陪你一起缩小。`;

    if (/[？?]$/.test(question) || /吗|什么|怎么|为什么|有没有|是不是/.test(question))
      return `这个问题我不能只靠旧记忆回答，也不想假装知道你的具体情况。

我可以先按常识和你当下这句话陪你拆：先看事实是什么、你在意什么、现在能做什么。你愿意的话，把背景补一句，我就能更具体。`;

    if (question.trim().length <= 12)
      return `我接到了。这里没有足够信息让我下判断，但可以继续聊。

你可以随便补一句背景，或者直接说你希望我陪你：听着、分析、给选择，还是一起定下一步。`;

    return `我先按你眼前这句话回应，不强行套旧记忆。

现在还缺少足够背景，所以我不会把它说成确定结论。你可以继续讲发生了什么；如果你想要更快一点，我也可以直接帮你把它拆成“事实、感受、选择、下一步”。`;
  }

  if (continuesPrevious) return undefined;

  return undefined;
};

const naturalClose = (selected: GuidanceSource[]) => {
  if (!selected.length) return '我在听。你不用整理成问题，直接说就好。';
  if (selected.some((s) => s.module === 'future'))
    return '先看这个方向是否仍适合当下，再比较继续、调整或暂停的条件和代价。';
  if (selected.some((s) => s.kind === '模式'))
    return '先不用急着改，我们可以看清它这次是怎么出现的。';
  if (selected.some((s) => s.kind === '原则'))
    return '先看这条原则的适用条件，以及这次是否需要不同的选择。';
  if (selected.some((s) => s.kind === '行动'))
    return '如果它现在太重，就把这一步缩小到今天真的能动的程度。';
  return '你可以继续说；值得保留的内容，需要你确认保存后才会成为正式记忆。';
};

/** Follow explicit links using identities that do not change when an object ends. */
export function expandGuidanceAssociations(selected: GuidanceSource[], sources: GuidanceSource[]) {
  for (let pass = 0; pass < 3 && selected.length < 4; pass++)
    for (const source of sources) {
      if (selected.length >= 4) break;
      if (
        !selected.some((item) => keyOf(item) === keyOf(source)) &&
        selected.some(
          (item) =>
            item.relatedKeys?.includes(keyOf(source)) || source.relatedKeys?.includes(keyOf(item)),
        )
      )
        selected.push(source);
    }
  return selected;
}

export function buildGroundedGuidance(
  question: string,
  sources: GuidanceSource[],
  previousQuestion?: string,
  options: GuidanceRetrievalOptions = {},
) {
  const now = Date.now();
  sources = sources.filter((source) =>
    options.range
      ? Boolean(
          source.evidence?.some(
            (e) => e.occurredAt >= options.range!.start && e.occurredAt < options.range!.end,
          ) ||
          source.results?.some((r) => {
            const occurredAt = Date.parse(r.occurredOn);
            return occurredAt >= options.range!.start && occurredAt < options.range!.end;
          }) ||
          (source.validFrom !== undefined &&
            source.validFrom < options.range!.end &&
            (source.validTo === undefined || source.validTo > options.range!.start)),
        )
      : (source.validFrom === undefined || source.validFrom <= now) &&
        (source.validTo === undefined || now < source.validTo),
  );
  const retrievalQuestion =
    previousQuestion && isAvatarContextContinuation(question) ? previousQuestion : question;
  const tokens = queryBigrams(retrievalQuestion);
  const starterKinds: Record<string, GuidanceSource['kind'][]> = {
    [GUIDANCE_STARTERS[0]]: ['模式', '原则'],
    [GUIDANCE_STARTERS[1]]: ['行动', '原则'],
    [GUIDANCE_STARTERS[2]]: ['目标', '愿景', '行动'],
  };
  const kinds = starterKinds[retrievalQuestion];
  const ranked = sources
    .map((source) => ({
      source,
      score:
        (options.preferredSourceIds?.includes(source.id) ? 4 : 0) +
        (kinds
          ? kinds.includes(source.kind)
            ? 10 - kinds.indexOf(source.kind)
            : 0
          : tokens.filter((token) =>
              [
                source.text,
                source.searchText,
                source.detail,
                ...(source.evidence ?? []).flatMap((e) => [e.text, e.searchText]),
                ...(source.results ?? []).map((r) => r.text),
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(token),
            ).length),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const selected: GuidanceSource[] = [];
  for (const { source } of ranked) {
    if (!kinds && selected.length) {
      if (selected[0].kind === '背景' && source.kind === '背景') selected.push(source);
      break;
    }
    const duplicateKind = selected.some((item) => item.kind === source.kind);
    // A period or semantic query may have more than one independent diary record.
    // Keep two background records instead of presenting one record as the whole story.
    if (
      !duplicateKind ||
      (source.kind === '背景' && selected.filter((item) => item.kind === '背景').length < 2)
    )
      selected.push(source);
    if (selected.length === 2) break;
  }
  expandGuidanceAssociations(selected, sources);
  if (!selected.length && previousQuestion && isAvatarContextContinuation(question)) {
    const previous = buildGroundedGuidance(previousQuestion, sources);
    if (previous.sources.length)
      return {
        sources: previous.sources,
        text: `好，我们沿着刚才那条线继续。\n\n${naturalSourceLine(previous.sources[0])}\n\n${naturalClose(previous.sources)}`,
      };
  }
  const naturalReply = buildNaturalAvatarReply(question, selected, previousQuestion, sources);
  if (naturalReply)
    return {
      sources: prepareSelectedSources(selected, retrievalQuestion),
      text: naturalReply,
    };
  const starterReply = naturalStarterReply(question);
  const lead = selected[0]
    ? naturalSourceLine(selected[0])
    : '我先按你刚说的来，不急着往旧记录上套。';
  const support = selected[1]
    ? `旁边还有一条「${selected[1].kind}」线索，我会参考，但不替你下结论。`
    : '';
  const close = starterReply ?? naturalClose(selected);
  return {
    sources: prepareSelectedSources(selected, retrievalQuestion),
    text: [lead, support, close].filter(Boolean).join('\n\n'),
  };
}

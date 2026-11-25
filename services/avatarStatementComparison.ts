export const memoryStatementKey = (statement: string) =>
  statement
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？；：、“”‘’,.!?;:"'()（）]/g, '')
    .toLocaleLowerCase();

/**
 * A deliberately narrow key for durable self-statements.
 *
 * It is only used for preferences and boundaries.  Unlike a semantic embedding,
 * this will not decide that two nearby ideas are the same.  It merely removes the
 * grammatical wrappers that cause the same assertion to be re-proposed, such as
 * “用户偏好…” and “我喜欢…”.  Conditions and objects remain part of the key.
 */
const durableAssertionBody = (statement: string, kind: 'preference' | 'boundary') => {
  let value = memoryStatementKey(statement);
  value = value
    .replace(/^(用户|我|本人|自己)/u, '')
    .replace(/^(偏好|喜欢|更喜欢|更想要|希望|倾向于|倾向|想要)/u, '');
  if (kind === 'boundary') {
    value = value.replace(/^(我的)?(边界|底线)(是|为)?/u, '');
    value = value.replace(/^(不想(?:再|一直)?|不再|不能接受|拒绝|不希望|不愿意)/u, '不');
  }
  // These are wording variants of the same *form* of expression, not a broad
  // semantic judgement.  The surrounding object/context is intentionally kept.
  return (
    value
      .replace(/(简短|精炼|少一些解释|少些解释|少解释)/gu, '简洁表达')
      // Keep this deliberately limited to a paired wording variant.  It avoids
      // treating neighbouring preferences as equal while covering the common
      // "简洁直接" / "直接、简洁" rewrite produced by different models.
      .replace(/(?:简洁直接|直接简洁)/gu, '简洁直接')
      .replace(/(回答|说明|解释)/gu, '表达')
      .replace(/(别人|他人)/gu, '他人')
      .replace(/(一直承担|承担着|承担)/gu, '承担')
      .replace(/的/gu, '')
      .trim()
  );
};

/**
 * Returns a key only when both statements belong to the same narrow durable
 * facet.  Callers must not use it as a general “similarity” test.
 */
export const durableMemoryAssertionKey = (
  statement: string,
  facets: readonly string[],
): string | null => {
  const kind = facets.includes('boundary')
    ? 'boundary'
    : facets.includes('preference')
      ? 'preference'
      : null;
  if (!kind) return null;
  const body = durableAssertionBody(statement, kind);
  return body.length >= 2 ? `${kind}:${body}` : null;
};

/** Capture labels describe provenance, not the scope of a preference. */
export const memoryScopeKey = (contexts: readonly string[] = []) =>
  [
    ...new Set(
      contexts
        .map(memoryStatementKey)
        .filter(
          (context) => !['来自聊天自述', '手动添加', '对话记忆', '待验证模式'].includes(context),
        ),
    ),
  ]
    .sort()
    .join('|');

type ComparableMemory = {
  statement: string;
  facets: readonly string[];
  contexts?: readonly string[];
  nature?: string;
};

/** Same durable assertion only within the same known scope and kind of claim. */
export const isSameDurableMemoryAssertion = (left: ComparableMemory, right: ComparableMemory) => {
  if (left.nature && right.nature && left.nature !== right.nature) return false;
  if (memoryScopeKey(left.contexts) !== memoryScopeKey(right.contexts)) return false;
  const leftKey = durableMemoryAssertionKey(left.statement, left.facets);
  return leftKey !== null && leftKey === durableMemoryAssertionKey(right.statement, right.facets);
};


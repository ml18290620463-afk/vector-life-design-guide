import type { DiaryEntry, Principle } from '../types';

export const LOCAL_SEMANTIC_MODEL = 'vector-local-semantic-v1';
export const LOCAL_SEMANTIC_DIMENSIONS = 192;
const LOCAL_SEMANTIC_MAX_TEXT_CHARS = 6000;

type SemanticSource = {
  text: string;
  tags?: string[];
};

export interface LocalSemanticIndexItem {
  entry: DiaryEntry;
  vector: number[];
}

export interface LocalSemanticMatch {
  entry: DiaryEntry;
  similarity: number;
}

const CONCEPT_TERMS: Record<string, string[]> = {
  communication: [
    '沟通',
    '交流',
    '会议',
    '讨论',
    '表达',
    '倾听',
    '客户',
    '同事',
    '汇报',
    '谈判',
    'communication',
    'meeting',
  ],
  decision: ['决定', '决策', '判断', '选择', '取舍', '犹豫', 'decision', 'choose', 'choice'],
  goal: ['目标', '计划', '方向', '优先级', '结果', '推进', 'goal', 'plan', 'priority'],
  work: ['工作', '项目', '职业', '任务', '客户', '同事', '老板', 'work', 'project', 'career'],
  relationship: [
    '关系',
    '朋友',
    '伴侣',
    '冲突',
    '误会',
    '信任',
    'relationship',
    'friend',
    'partner',
  ],
  family: ['家庭', '家人', '父母', '孩子', '妈妈', '爸爸', 'family', 'parent', 'child'],
  health: ['健康', '身体', '睡眠', '运动', '疼痛', '医院', 'health', 'sleep', 'exercise'],
  emotion: ['焦虑', '开心', '愤怒', '疲惫', '难过', '平静', '压力', 'emotion', 'anxious', 'stress'],
  growth: ['成长', '学习', '复盘', '意识', '改变', '突破', '经验', 'growth', 'learn', 'reflect'],
  finance: ['财务', '收入', '预算', '投资', '花费', '工资', 'finance', 'budget', 'income'],
  rest: ['休息', '放松', '旅行', '散步', '娱乐', '休假', 'rest', 'relax', 'travel'],
};

const normalizeTag = (tag: string): string =>
  tag
    .replace(/^(心情|事件):/, '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();

const addFeature = (features: Map<string, number>, feature: string, weight: number) => {
  if (!feature) return;
  features.set(feature, (features.get(feature) ?? 0) + weight);
};

const extractFeatures = ({ text, tags = [] }: SemanticSource): Map<string, number> => {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LOCAL_SEMANTIC_MAX_TEXT_CHARS);
  const features = new Map<string, number>();

  for (const tag of tags.map(normalizeTag).filter(Boolean)) {
    addFeature(features, `tag:${tag}`, 3);
  }

  for (const token of normalized.match(/[a-z0-9]{3,}/g) ?? []) {
    addFeature(features, `word:${token}`, 1);
  }

  for (const run of normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    if (run.length <= 4) addFeature(features, `term:${run}`, 1.5);
    for (let index = 0; index < run.length - 1; index += 1) {
      addFeature(features, `gram:${run.slice(index, index + 2)}`, 0.8);
    }
  }

  const conceptText = `${normalized} ${tags.map(normalizeTag).join(' ')}`;
  for (const [concept, terms] of Object.entries(CONCEPT_TERMS)) {
    const matches = terms.filter((term) => conceptText.includes(term)).length;
    if (matches > 0) addFeature(features, `concept:${concept}`, Math.min(4, 2 + matches));
  }

  return features;
};

const hashFeature = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const buildLocalSemanticVector = (source: SemanticSource): number[] => {
  const vector = Array.from<number>({ length: LOCAL_SEMANTIC_DIMENSIONS }).fill(0);

  for (const [feature, weight] of extractFeatures(source)) {
    const hash = hashFeature(feature);
    const position = hash % LOCAL_SEMANTIC_DIMENSIONS;
    const sign = (hash >>> 8) & 1 ? 1 : -1;
    vector[position] += weight * sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
};

export const cosineSimilarity = (first: number[], second: number[]): number => {
  if (first.length !== second.length || first.length === 0) return 0;
  return first.reduce((sum, value, index) => sum + value * second[index]!, 0);
};

const entryToSemanticSource = (
  entry: Pick<DiaryEntry, 'title' | 'content' | 'tags'>,
): SemanticSource => ({
  text: `${entry.title} ${entry.content}`,
  tags: entry.tags,
});

export const principleToSemanticSource = (
  principle: Pick<Principle, 'text' | 'application'>,
  evidenceEntries: Array<Pick<DiaryEntry, 'tags'>> = [],
): SemanticSource => ({
  text: [principle.text, principle.application?.trigger, principle.application?.action]
    .filter(Boolean)
    .join(' '),
  tags: evidenceEntries.flatMap((entry) => entry.tags),
});

export const semanticSimilarity = (first: SemanticSource, second: SemanticSource): number =>
  cosineSimilarity(buildLocalSemanticVector(first), buildLocalSemanticVector(second));

export const buildLocalSemanticIndex = (entries: DiaryEntry[]): LocalSemanticIndexItem[] =>
  entries
    .filter(
      (entry) =>
        !entry.isSample &&
        !entry.isArchived &&
        (!entry.unlockAt || entry.unlockAt <= Date.now()) &&
        `${entry.title}${entry.content}`.trim().length > 0,
    )
    .map((entry) => ({
      entry,
      vector: buildLocalSemanticVector(entryToSemanticSource(entry)),
    }));

export const searchLocalSemanticIndex = (
  query: Pick<DiaryEntry, 'title' | 'content' | 'tags'>,
  index: LocalSemanticIndexItem[],
  limit = 3,
  minimumSimilarity = 0.24,
): LocalSemanticMatch[] => {
  if (limit <= 0) return [];
  const queryVector = buildLocalSemanticVector(entryToSemanticSource(query));

  return index
    .map(({ entry, vector }) => ({
      entry,
      similarity: cosineSimilarity(queryVector, vector),
    }))
    .filter(({ similarity }) => similarity >= minimumSimilarity)
    .sort(
      (first, second) =>
        second.similarity - first.similarity || second.entry.createdAt - first.entry.createdAt,
    )
    .slice(0, limit);
};

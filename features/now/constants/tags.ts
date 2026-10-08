export const MOOD_TAGS = ['平静', '开心', '兴奋', '焦虑', '疲惫', '迷茫', '难过', '愤怒', '感动'];

export const EVENT_TAG_HINTS: Record<string, string> = {
  工作事业: '工作 · 求职 · 发展',
  学习探索: '学业 · 技能 · 求知',
  财务收支: '收入 · 消费 · 理财',
  身心健康: '身体 · 情绪 · 作息',
  人际交往: '朋友 · 同事 · 社交',
  家庭亲密: '家人 · 伴侣 · 亲子',
  生活起居: '居住 · 家务 · 出行',
  兴趣休闲: '爱好 · 娱乐 · 游玩',
};

export const EVENT_TAGS = [...Object.keys(EVENT_TAG_HINTS), '自定义锚点'];

// Historical labels remain valid without reinterpreting existing diary entries.
export const LEGACY_EVENT_TAGS = [
  '职业发展',
  '财务状况',
  '身体健康',
  '人际关系',
  '家庭情感',
  '个人成长',
  '娱乐休闲',
  '自我实现',
];

export const inferEventTags = (text: string): string[] => {
  const rules: Array<[string, RegExp]> = [
    ['工作事业', /工作|项目|会议|客户|老板|面试|职业|汇报|求职|创业/],
    ['学习探索', /学习|学业|考试|技能|练习|求知|课程|读书/],
    ['财务收支', /收入|工资|花费|预算|投资|财务|消费|储蓄|借贷|理财/],
    ['身心健康', /身体|睡眠|运动|生病|疼痛|健康|医院|心理状态|情绪|作息/],
    ['人际交往', /朋友|同事|社交|人际|社群|关系/],
    ['家庭亲密', /家人|父母|妈妈|爸爸|孩子|伴侣|家庭|恋爱|亲子/],
    ['生活起居', /居住|家务|出行|租房|搬家|做饭|收拾|通勤|办事/],
    ['兴趣休闲', /电影|游戏|旅行|游玩|音乐|娱乐|爱好|休闲|烘焙/],
  ];
  return rules
    .filter(([, pattern]) => pattern.test(text))
    .map(([tag]) => tag)
    .slice(0, 3);
};

export const TAG_SLOGAN = '# 每个故事，最终归向自己';

// Retrieval aliases only; stored labels are never rewritten.
export const eventTagForLookup = (tag: string): string =>
  (
    ({
      职业发展: '工作事业',
      财务状况: '财务收支',
      身体健康: '身心健康',
      人际关系: '人际交往',
      家庭情感: '家庭亲密',
      娱乐休闲: '兴趣休闲',
    }) as Record<string, string>
  )[tag] ?? tag;

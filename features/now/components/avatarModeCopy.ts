export const MODE_COPY = {
  capture: {
    title: '帮我记一笔',
    description: '只生成待确认记录，不会自动保存',
    placeholder: '输入想记录的内容',
    action: '生成记录',
  },
  distill: {
    title: '帮我记一笔',
    description: '参考你提供的经历，不会自动保存',
    placeholder: '输入要整理的经历',
    action: '生成理解',
  },
  recall: {
    title: '问问我自己',
    description: '参考本次获准携带的资料，不会自动保存',
    placeholder: '输入要查找的问题',
    action: '查找过去',
  },
  decide: {
    title: '帮我拿主意与复盘',
    description: '参考本次获准携带的资料，不会自动保存',
    placeholder: '输入你的选择或犹豫',
    action: '查看建议',
  },
  review: {
    title: '帮我拿主意与复盘',
    description: '参考你提供的结果，不会自动保存',
    placeholder: '实际发生了什么？',
    action: '更新理解',
  },
  general: {
    title: '问问我自己',
    description: '参考本次获准携带的资料，不会自动保存',
    placeholder: '直接说，我在听',
    action: '形成理解',
  },
} as const;

export const EN_MODE_COPY = {
  capture: {
    title: 'Help me record',
    description: 'Drafts need your confirmation to save',
    placeholder: 'What would you like to record?',
    action: 'Create record',
  },
  distill: {
    title: 'Help me record',
    description: 'Uses the experience you share; nothing is saved automatically',
    placeholder: 'Describe the experience',
    action: 'Draft understanding',
  },
  recall: {
    title: 'Ask myself',
    description: 'Uses only approved sources; nothing is saved automatically',
    placeholder: 'What would you like to find?',
    action: 'Search past',
  },
  decide: {
    title: 'Decide and review',
    description: 'Uses only approved sources; nothing is saved automatically',
    placeholder: 'Describe your choices or uncertainty',
    action: 'View suggestions',
  },
  review: {
    title: 'Decide and review',
    description: 'Uses the outcome you share; nothing is saved automatically',
    placeholder: 'What actually happened?',
    action: 'Update understanding',
  },
  general: {
    title: 'Ask myself',
    description: 'Uses only approved sources; nothing is saved automatically',
    placeholder: 'Tell me what is on your mind',
    action: 'Draft understanding',
  },
} as const;

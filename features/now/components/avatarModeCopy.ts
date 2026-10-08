export const MODE_COPY = {
  capture: {
    title: '帮我记录',
    description: '说一件事',
    placeholder: '输入想记录的内容',
    action: '生成记录',
  },
  distill: {
    title: '帮我整理',
    description: '整理经历',
    placeholder: '输入要整理的经历',
    action: '生成理解',
  },
  recall: {
    title: '问问过去',
    description: '查找记录',
    placeholder: '输入要查找的问题',
    action: '查找过去',
  },
  decide: {
    title: '帮我分析',
    description: '整理选择',
    placeholder: '输入你的选择或犹豫',
    action: '查看建议',
  },
  review: {
    title: '回顾结果',
    description: '记录结果',
    placeholder: '实际发生了什么？',
    action: '更新理解',
  },
  general: {
    title: '分身',
    description: '连接过去、现在与未来',
    placeholder: '直接说，我在听',
    action: '形成理解',
  },
} as const;

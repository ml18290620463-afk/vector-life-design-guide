/** Independent deterministic contract set. Never a model/embedding quality benchmark. */
export const englishHoldout = [
  { id: 'en-pattern', group: 'en', question: 'Which patterns have I confirmed?', kind: 'patterns' },
  {
    id: 'en-principle',
    group: 'en',
    question: 'Show my principles and their evidence.',
    kind: 'principles',
  },
  {
    id: 'en-evidence',
    group: 'en',
    question: 'What evidence supports these conclusions?',
    kind: 'both',
  },
  {
    id: 'en-exception',
    group: 'en',
    question: 'What exceptions apply to my principles?',
    kind: 'principles',
  },
  { id: 'en-case', group: 'en', question: 'SHOW THE SOURCES?', kind: 'both' },
  {
    id: 'en-narrative',
    group: 'en',
    question: 'I used a principle at work today.',
    kind: 'narrative',
  },
  {
    id: 'mix-pattern',
    group: 'mixed',
    question: 'Show 我认可的模式 and evidence',
    kind: 'patterns',
  },
  {
    id: 'mix-principle',
    group: 'mixed',
    question: '这些 principles 有哪些依据？',
    kind: 'principles',
  },
  { id: 'mix-evidence', group: 'mixed', question: 'What 证据 supports this?', kind: 'both' },
  { id: 'mix-exception', group: 'mixed', question: '原则有哪些 exceptions?', kind: 'principles' },
  { id: 'mix-case', group: 'mixed', question: '查看 sources', kind: 'both' },
  {
    id: 'mix-narrative',
    group: 'mixed',
    question: '今天我 followed a principle at work.',
    kind: 'narrative',
  },
] as const;

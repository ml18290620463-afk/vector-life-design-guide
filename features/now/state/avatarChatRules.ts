import { accountLocalStorage } from '../../../services/accountScope';
import type { DiaryEntry } from '../../../types';
import type { AvatarRecallMemory } from './nowRules';
import { STORAGE_KEYS } from '../constants/config';
import type { ChatMessage } from '../types/now';
import type { AvatarMode } from '../../avatar/types';

export const buildAssistantTextMessage = (
  content: string,
  options: {
    id: string;
    createdAt: string;
    references?: ChatMessage['references'];
    modelAssistance?: ChatMessage['modelAssistance'];
  },
): ChatMessage => ({
  id: options.id,
  role: 'assistant',
  type: 'text',
  content,
  created_at: options.createdAt,
  references: options.references,
  modelAssistance: options.modelAssistance,
});

export const buildUserTextMessage = (
  content: string,
  options: { id: string; createdAt: string },
): ChatMessage => ({
  id: options.id,
  role: 'user',
  type: 'text',
  content,
  created_at: options.createdAt,
});

export const buildRecordPreviewMessage = (
  payload: NonNullable<ChatMessage['payload']>,
  options: { id: string; createdAt: string },
): ChatMessage => ({
  id: options.id,
  role: 'assistant',
  type: 'record_preview',
  content: 'record_preview',
  payload,
  created_at: options.createdAt,
});

export const getAvatarIntroMessages = (args: {
  isFirstVisit: boolean;
  createdAt: string;
  createId: () => string;
  mode?: AvatarMode;
  language?: 'zh' | 'en';
}) => {
  const t = (zh: string, en: string) => (args.language === 'en' ? en : zh);
  if (args.mode === 'review') {
    return [
      buildAssistantTextMessage(
        t(
          '记录真实结果。完成后保存到「过去」。',
          'Record what actually happened. Save it to Past when finished.',
        ),
        {
          id: args.createId(),
          createdAt: args.createdAt,
        },
      ),
    ];
  }
  if (args.mode === 'general') {
    return [
      buildAssistantTextMessage(
        args.isFirstVisit
          ? t('我是 VECTOR。说一件事就好。', 'I am VECTOR. Start with one thing.')
          : t('我在。继续说。', 'I am here. Go on.'),
        { id: args.createId(), createdAt: args.createdAt },
      ),
    ];
  }
  return args.isFirstVisit
    ? [
        buildAssistantTextMessage(
          t(
            '说一件事。完成后生成记录。',
            'Tell me about one thing. Create a record when finished.',
          ),
          {
            id: args.createId(),
            createdAt: args.createdAt,
          },
        ),
      ]
    : [
        buildAssistantTextMessage(
          t('继续说。完成后生成记录。', 'Go on. Create a record when finished.'),
          {
            id: args.createId(),
            createdAt: args.createdAt,
          },
        ),
      ];
};

export const readAndMarkAvatarIntroFirstVisit = (storage: Storage = accountLocalStorage) => {
  const isFirstVisit = storage.getItem(STORAGE_KEYS.avatarIntroShown) !== 'true';
  storage.setItem(STORAGE_KEYS.avatarIntroShown, 'true');
  return isFirstVisit;
};

export const entryToRecallMemory = (entry: DiaryEntry): AvatarRecallMemory => ({
  id: `avatar-entry-${entry.id}`,
  sourceEntryId: entry.id,
  title: entry.title,
  excerpt: entry.content.replace(/\s+/g, ' ').trim().slice(0, 120),
  tags: entry.tags ?? [],
  score: 1,
  createdAt: entry.createdAt,
  reason: '你正在整理的原始记录',
});

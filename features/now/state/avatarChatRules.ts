import { STORAGE_KEYS } from '../constants/config';
import type { ChatMessage } from '../types/now';
import type { AvatarMode } from '../../avatar/types';

export const buildAssistantTextMessage = (
  content: string,
  options: { id: string; createdAt: string },
): ChatMessage => ({
  id: options.id,
  role: 'assistant',
  type: 'text',
  content,
  created_at: options.createdAt,
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
}) => {
  if (args.mode === 'review') {
    return [
      buildAssistantTextMessage(
        '请只记录真实发生的结果：做了什么、发生了什么、原原则哪里有效或需要调整。完成后再保存到「过去」。',
        { id: args.createId(), createdAt: args.createdAt },
      ),
    ];
  }
  if (args.mode === 'general') {
    return [
      buildAssistantTextMessage(
        args.isFirstVisit
          ? '你好，我是 VECTOR。我会结合你的真实记录，陪你看见当下不易察觉的另一个角度。'
          : '我在。你不用先得出结论，我们可以从一句还没整理好的话开始。',
        { id: args.createId(), createdAt: args.createdAt },
      ),
    ];
  }
  return args.isFirstVisit
    ? [
        buildAssistantTextMessage(
          '你好，我是你的分身。我可以帮你记录此刻：把今天发生的事、你的感受、想法，整理成一条完整记录，存进「过去」。',
          { id: args.createId(), createdAt: args.createdAt },
        ),
        buildAssistantTextMessage(
          '你不用整理，像平时聊天一样说就好。我会边听边提炼事实、感受、想法和结果；说到差不多时点「记录完毕」，我再给你一版可确认的记录。',
          { id: args.createId(), createdAt: args.createdAt },
        ),
      ]
    : [
        buildAssistantTextMessage('你自然说，我会边听边提炼。说到差不多时点「记录完毕」。', {
          id: args.createId(),
          createdAt: args.createdAt,
        }),
      ];
};

export const readAndMarkAvatarIntroFirstVisit = (storage: Storage = window.localStorage) => {
  const isFirstVisit = storage.getItem(STORAGE_KEYS.avatarIntroShown) !== 'true';
  storage.setItem(STORAGE_KEYS.avatarIntroShown, 'true');
  return isFirstVisit;
};

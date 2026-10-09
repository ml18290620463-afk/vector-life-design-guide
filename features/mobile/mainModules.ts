import React from 'react';
import { Archive, Bot, Clock3, Sparkles } from 'lucide-react';
import type { Language } from '../../types';
import type { MobileMainTab } from './types';

export interface MainModuleDefinition {
  id: MobileMainTab;
  title: string;
  hint: string;
  commandLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export const getMainModules = (language: Language): MainModuleDefinition[] => {
  const isZh = language === 'zh';
  return [
    {
      id: 'past',
      title: isZh ? '过去' : 'Past',
      hint: isZh ? '回看经历与当前理解' : 'Review experiences and understanding',
      commandLabel: isZh ? '打开 Past' : 'Open Past',
      Icon: Archive,
    },
    {
      id: 'now',
      title: isZh ? '现在' : 'Now',
      hint: isZh ? '记录此刻' : 'Capture now',
      commandLabel: isZh ? '打开 Now' : 'Open Now',
      Icon: Clock3,
    },
    {
      id: 'future',
      title: isZh ? '未来' : 'Future',
      hint: isZh ? '设计尝试与记录结果' : 'Plan attempts and record results',
      commandLabel: isZh ? '打开 Future' : 'Open Future',
      Icon: Sparkles,
    },
    {
      id: 'avatar',
      title: isZh ? '分身' : 'Avatar',
      hint: isZh ? '借助资料理解自己' : 'Understand yourself through your records',
      commandLabel: isZh ? '打开 Avatar' : 'Open Avatar',
      Icon: Bot,
    },
  ];
};

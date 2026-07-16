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
      hint: isZh ? '素材、复盘、原则' : 'Material, review, principles',
      commandLabel: isZh ? '打开 Past' : 'Open Past',
      Icon: Archive,
    },
    {
      id: 'now',
      title: isZh ? '现在' : 'Now',
      hint: isZh ? '记录此刻与行动' : 'Record and act',
      commandLabel: isZh ? '打开 Now' : 'Open Now',
      Icon: Clock3,
    },
    {
      id: 'future',
      title: isZh ? '未来' : 'Future',
      hint: isZh ? '目标、推演、转化' : 'Goals and transformation',
      commandLabel: isZh ? '打开 Future' : 'Open Future',
      Icon: Sparkles,
    },
    {
      id: 'avatar',
      title: isZh ? '分身' : 'Avatar',
      hint: isZh ? '记忆协助与对话' : 'Memory-assisted dialogue',
      commandLabel: isZh ? '打开 Avatar' : 'Open Avatar',
      Icon: Bot,
    },
  ];
};

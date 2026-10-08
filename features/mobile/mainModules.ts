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
      hint: isZh ? '回看与沉淀' : 'Review and distill',
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
      hint: isZh ? '设计与践行' : 'Design and practice',
      commandLabel: isZh ? '打开 Future' : 'Open Future',
      Icon: Sparkles,
    },
    {
      id: 'avatar',
      title: isZh ? '分身' : 'Avatar',
      hint: isZh ? '关于我、我的模式与变化' : 'About me, patterns and changes',
      commandLabel: isZh ? '打开 Avatar' : 'Open Avatar',
      Icon: Bot,
    },
  ];
};

import React from 'react';
import { Sparkles } from 'lucide-react';
import type { Language } from '../../types';

interface FuturePlaceholderProps {
  language: Language;
}

export const FuturePlaceholder: React.FC<FuturePlaceholderProps> = ({ language }) => (
  <main className="mobile-future-page" data-testid="future-page">
    <header className="mobile-future-page__header">
      <p className="mobile-future-page__eyebrow">
        {language === 'zh' ? 'VECTOR · 未来' : 'VECTOR · Future'}
      </p>
      <h1>{language === 'zh' ? '分析转化' : 'Analysis & Transformation'}</h1>
    </header>
    <section className="mobile-future-page__body">
      <div className="mobile-future-page__icon" aria-hidden="true">
        <Sparkles className="h-8 w-8" />
      </div>
      <p className="mobile-future-page__title">
        {language === 'zh' ? '未来模块筹备中' : 'Future module in preparation'}
      </p>
      <p className="mobile-future-page__desc">
        {language === 'zh'
          ? '这里将承接从「过去」沉淀出的模式洞察与转化路径。当前版本请先使用「现在」写入、「过去」回看。'
          : 'This space will host pattern insights and transformation paths from your past records. For now, write in Now and review in Past.'}
      </p>
    </section>
  </main>
);

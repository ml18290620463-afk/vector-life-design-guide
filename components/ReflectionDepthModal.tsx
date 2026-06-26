import React from 'react';
import { AnimatePresence } from 'motion/react';
import type { Language, Theme } from '../types';

const reflectionDepthOptions = [
  { zh: '只是放下', en: 'Just release' },
  { zh: '陪我理一理', en: 'Help me sort it out' },
  { zh: '帮我看清', en: 'Help me see clearly' },
];

interface ReflectionDepthModalProps {
  open: boolean;
  theme: Theme;
  language: Language;
  depth: number;
  onDepthChange: (depth: number) => void;
  onCancel: () => void;
  onContinue: () => void;
}

export const ReflectionDepthModal: React.FC<ReflectionDepthModalProps> = ({
  open,
  theme,
  language,
  depth,
  onDepthChange,
  onCancel,
  onContinue,
}) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <button
          type="button"
          aria-label={language === 'zh' ? '关闭选择深度' : 'Close depth selection'}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onCancel}
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="reflection-depth-title"
          className={`relative z-10 w-full max-w-xl border rounded-xl p-6 shadow-2xl ${theme === 'light' ? 'bg-white border-cyan-200 text-slate-900' : 'bg-[#020811]/95 border-cyan-500/30 text-cyan-50 shadow-[0_0_48px_rgba(6,182,212,0.18)]'}`}
          data-testid="reflection-depth-modal"
        >
          <div className="mb-6">
            <p
              className={`text-[10px] font-mono uppercase tracking-[0.32em] mb-2 ${theme === 'light' ? 'text-cyan-700' : 'text-cyan-400/80'}`}
            >
              {language === 'zh' ? '第二步' : 'Step 2'}
            </p>
            <h3 id="reflection-depth-title" className="text-2xl font-light tracking-[0.18em]">
              {language === 'zh' ? '选择深度' : 'Choose depth'}
            </h3>
          </div>

          <div className="space-y-5">
            <input
              type="range"
              min={0}
              max={2}
              step={1}
              value={depth}
              onChange={(event) => onDepthChange(Number(event.target.value))}
              aria-label={language === 'zh' ? '心理强度' : 'Reflection depth'}
              className="w-full accent-cyan-400"
              data-testid="reflection-depth-slider"
            />
            <div className="grid grid-cols-3 gap-2">
              {reflectionDepthOptions.map((option, index) => {
                const label = language === 'zh' ? option.zh : option.en;
                const active = depth === index;
                return (
                  <button
                    key={option.zh}
                    type="button"
                    onClick={() => onDepthChange(index)}
                    className={`min-h-12 border px-2 py-2 text-xs tracking-widest transition-colors ${
                      active
                        ? theme === 'light'
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                          : 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                        : theme === 'light'
                          ? 'border-slate-200 text-slate-500 hover:border-cyan-300'
                          : 'border-cyan-900/50 text-cyan-700 hover:border-cyan-500/50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className={`px-4 py-2 text-xs uppercase tracking-widest border rounded-md ${theme === 'light' ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={onContinue}
              className={`px-4 py-2 text-xs uppercase tracking-widest border rounded-md ${theme === 'light' ? 'border-cyan-400 bg-cyan-50 text-cyan-800 hover:bg-cyan-100' : 'border-cyan-400/60 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20'}`}
            >
              {language === 'zh' ? '继续刻录' : 'Continue'}
            </button>
          </div>
        </section>
      </div>
    )}
  </AnimatePresence>
);

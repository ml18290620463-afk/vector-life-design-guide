import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BookOpen,
  Compass,
  Eye,
  MessageSquareQuote,
  RefreshCcw,
  Route,
  Scan,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import Markdown, { Components } from 'react-markdown';
import { DiaryEntry, Theme } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import type { MorningStarAnalyzeInput } from '../hooks/useMorningStarPipeline';
import { KleinBottleFoldSpace } from './KleinBottleFoldSpace';

export type ReadingStep = 'reading' | 'reflecting' | 'evaluation';

interface ParsedAnalysis {
  content: string;
  metrics: Record<string, number>;
}

interface MorningStarPanelProps {
  theme: Theme;
  t: TranslationDictionary;
  entry: DiaryEntry;
  guidingStars: string[];
  readingStep: ReadingStep;
  setReadingStep: (step: ReadingStep) => void;
  reflectionText: string;
  setReflectionText: (value: string) => void;
  morningStarPersonas: string[];
  setMorningStarPersonas: (personas: string[]) => void;
  morningStarLoading: boolean;
  morningStarError: string | null;
  /**
   * W2.4 — incremental SSE preview text. When non-empty AND
   * morningStarLoading is true, the loading panel shows the streamed
   * deltas in a "thinking" affordance instead of a static spinner.
   */
  morningStarStreamingPreview?: string;
  parsedAnalysis: ParsedAnalysis | null;
  onAnalyze: (input?: MorningStarAnalyzeInput) => void;
  onDeleteAnalysis: () => void;
  markdownComponents: Components;
}

const getEntryHint = (entry: DiaryEntry): string => {
  const source = `${entry.title}\n${entry.content}`.replace(/\s+/g, ' ').trim();
  if (!source) return '你刚刚写下的经历已经在这里。';
  return source.length > 72 ? `${source.slice(0, 72)}...` : source;
};

const lensOptions = [
  {
    id: 'sort',
    title: '先理清',
    instruction:
      '这次请以“梳理现状”为主：先区分事实、解释、感受、需求和已经发生的结果，帮我看清我现在站在哪里。',
    icon: Compass,
  },
  {
    id: 'essence',
    title: '看关键',
    instruction:
      '这次请以“洞察本质”为主：不要急着给建议，先看这件事背后的核心张力、重复模式、欲望或我没有说出口的恐惧。',
    icon: Eye,
  },
  {
    id: 'solution',
    title: '给一步',
    instruction:
      '这次请以“给出解决方案”为主：在不替我下结论的前提下，给我一个温和、可执行、成本很小的下一步。',
    icon: Route,
  },
] as const;

export const MorningStarPanel: React.FC<MorningStarPanelProps> = ({
  theme,
  t,
  entry,
  guidingStars,
  readingStep,
  setReadingStep,
  reflectionText,
  setReflectionText,
  morningStarPersonas,
  setMorningStarPersonas,
  morningStarLoading,
  morningStarError,
  morningStarStreamingPreview,
  parsedAnalysis,
  onAnalyze,
  onDeleteAnalysis,
  markdownComponents,
}) => {
  const [understandingNoteOpen, setUnderstandingNoteOpen] = useState(false);
  const [understandingNote, setUnderstandingNote] = useState('');
  const [savedSignal, setSavedSignal] = useState(false);

  const surface =
    theme === 'light'
      ? 'bg-white border-slate-100 text-slate-800 shadow-sm'
      : 'bg-cyan-950/5 border-cyan-500/10 text-cyan-50/90 shadow-[0_0_40px_color-mix(in_srgb,_var(--color-cyan-500)_3%,_transparent)]';
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-cyan-100/55';
  const subtleSurface =
    theme === 'light'
      ? 'bg-slate-50 border-slate-100 text-slate-700'
      : 'bg-black/20 border-cyan-900/20 text-cyan-100/70';
  const primaryText = theme === 'light' ? 'text-slate-800' : 'text-cyan-50';
  const accentText = theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-300';

  const ensurePersonaSeed = () => {
    if (morningStarPersonas.length > 0) return;
    if (guidingStars.length > 0) {
      setMorningStarPersonas([guidingStars[0]]);
    }
  };

  const getSeededPersonas = () => {
    if (morningStarPersonas.length > 0) return morningStarPersonas;
    if (guidingStars.length > 0) return [guidingStars[0]];
    return [];
  };

  const handleAnalyze = () => {
    ensurePersonaSeed();
    onAnalyze();
  };

  const handleLensAnalyze = (instruction: string) => {
    const seededPersonas = getSeededPersonas();
    const nextReflection = reflectionText.trim()
      ? `${reflectionText.trim()}\n\n${instruction}`
      : instruction;
    if (seededPersonas.length > 0) setMorningStarPersonas(seededPersonas);
    setReflectionText(nextReflection);
    onAnalyze({ reflectionText: nextReflection, personas: seededPersonas });
  };

  const handleAskMore = () => {
    setReadingStep('reflecting');
  };

  const handleAnotherLens = () => {
    const nudge = '请换一个角度继续看，不要重复上一封回信。';
    setReflectionText(reflectionText.trim() ? `${reflectionText.trim()}\n\n${nudge}` : nudge);
    setReadingStep('reflecting');
  };

  return (
    <div
      className={`mt-16 pt-12 border-t ${theme === 'light' ? 'border-[color-mix(in_srgb,_var(--color-vector-cyan-brand)_10%,_transparent)]' : 'border-cyan-900/40'}`}
    >
      {readingStep === 'reading' && (
        <div className="relative min-h-[560px] overflow-hidden border border-cyan-100/22 bg-[#02050b] p-5 text-center shadow-[0_30px_100px_rgba(0,0,0,0.38),inset_0_0_60px_rgba(56,189,248,0.08)] md:min-h-[620px] md:p-8">
          <KleinBottleFoldSpace compact className="opacity-[0.72]" />
          <div className="pointer-events-none absolute inset-0 border border-cyan-200/14" />
          <div className="pointer-events-none absolute inset-[1rem] border border-violet-200/10 md:inset-[1.35rem]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(2,8,23,0.02),rgba(2,6,23,0.36)_54%,rgba(2,6,23,0.78)_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#02050b]/86 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#02050b]/92 to-transparent" />

          <div className="relative z-10 mx-auto flex min-h-[510px] max-w-2xl flex-col items-center justify-center gap-5 md:min-h-[560px]">
            <div className="flex items-center gap-2">
              <Star className={`h-4 w-4 ${accentText}`} />
              <div className={`text-[10px] font-mono uppercase tracking-[0.24em] ${accentText}`}>
                Morning Star
              </div>
            </div>

            <div className="space-y-2">
              <h3 className={`text-xl font-semibold tracking-[0.04em] sm:text-2xl ${primaryText}`}>
                让启明星帮你看一眼
              </h3>
              <p className={`text-sm leading-6 ${mutedText}`}>选一个关注点，或直接开始。</p>
            </div>

            <div
              className={`w-full border px-4 py-3 text-left text-sm leading-6 backdrop-blur-xl ${
                theme === 'light'
                  ? 'border-white/70 bg-white/78 text-slate-700'
                  : 'border-cyan-100/12 bg-[#03111d]/66 text-cyan-100/76'
              }`}
            >
              <div
                className={`mb-1 text-[10px] font-mono uppercase tracking-[0.18em] ${accentText}`}
              >
                这次记录
              </div>
              <div className="line-clamp-2">{getEntryHint(entry)}</div>
            </div>

            {morningStarError && (
              <div
                className={`p-4 border text-sm max-w-xl ${theme === 'light' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/20 border-rose-900/30 text-rose-300'}`}
              >
                {morningStarError}
              </div>
            )}

            <div className="grid w-full grid-cols-3 gap-2">
              {lensOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleLensAnalyze(option.instruction)}
                    disabled={morningStarLoading}
                    className={`group flex h-20 flex-col items-center justify-center gap-2 border px-2 text-center backdrop-blur-xl transition-all duration-300 disabled:cursor-wait disabled:opacity-60 ${theme === 'light' ? 'bg-white/78 border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50' : 'bg-[#03111d]/68 border-cyan-200/14 hover:border-cyan-200/40 hover:bg-cyan-300/10'}`}
                  >
                    <Icon className={`h-4 w-4 ${accentText}`} />
                    <span className={`text-sm font-semibold tracking-[0.06em] ${primaryText}`}>
                      {option.title}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <CyberButton onClick={handleAnalyze} disabled={morningStarLoading} theme={theme}>
                {morningStarLoading ? (
                  <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                直接开始
              </CyberButton>
              <CyberButton
                variant="ghost"
                onClick={() => setReadingStep('reflecting')}
                theme={theme}
              >
                补一句
              </CyberButton>
            </div>

            <button
              type="button"
              className={`text-xs transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-cyan-800 hover:text-cyan-500'}`}
            >
              今天到这里
            </button>
          </div>
        </div>
      )}

      {readingStep === 'reflecting' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-7"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-sm bg-cyan-500/10 text-cyan-400">
              <MessageSquareQuote className="w-4 h-4" />
            </div>
            <span className={`text-xs font-mono uppercase tracking-widest ${accentText}`}>
              我现在最想弄明白的是
            </span>
          </div>

          <textarea
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            placeholder="可以只写一句困惑。也可以留空，让启明星直接读你刚写下的经历。"
            className={`w-full min-h-[150px] p-6 font-serif text-lg border transition-all outline-none leading-relaxed
              ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200 focus:border-cyan-400 text-slate-800 shadow-inner'
                  : 'bg-black/40 border-cyan-900/30 focus:border-cyan-500/50 text-cyan-50 shadow-[inset_0_0_20px_color-mix(in_srgb,_var(--color-cyan-500)_5%,_transparent)]'
              }`}
          />

          <div className={`text-xs leading-relaxed ${mutedText}`}>
            这不是作业。补充这句话只是为了让启明星更贴近你此刻真正想看的地方。
          </div>

          {morningStarError && (
            <div
              className={`p-4 border text-sm ${theme === 'light' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/20 border-rose-900/30 text-rose-300'}`}
            >
              {morningStarError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <CyberButton onClick={handleAnalyze} disabled={morningStarLoading} theme={theme}>
              {morningStarLoading ? (
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              继续照见
            </CyberButton>
            <CyberButton variant="ghost" onClick={() => setReadingStep('reading')} theme={theme}>
              先不补了
            </CyberButton>
          </div>
        </motion.div>
      )}

      {readingStep === 'evaluation' && (
        <div className="space-y-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-sm bg-amber-500/10 text-amber-500">
                <Star className="w-4 h-4" />
              </div>
              <span className={`text-xs font-mono uppercase tracking-widest ${accentText}`}>
                启明星的照见回信
              </span>
            </div>

            {reflectionText.trim() && (
              <div className={`p-5 border italic leading-relaxed font-serif ${subtleSurface}`}>
                {reflectionText}
              </div>
            )}
          </div>

          <div className="relative">
            {morningStarLoading ? (
              <div
                className={`p-12 border border-dashed flex flex-col items-center gap-6 ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-cyan-900/30'}`}
                data-testid="morning-star-loading"
              >
                <div className="relative">
                  <div className="absolute inset-0 blur-xl bg-cyan-500/20 animate-pulse rounded-full" />
                  <Scan className="w-12 h-12 text-cyan-400 animate-spin" />
                </div>
                <div className="text-center space-y-2">
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-600 animate-pulse">
                    启明星正在读你刚刚写下的经历
                  </div>
                  <div className={`text-[11px] leading-relaxed ${mutedText}`}>
                    它会先判断这次更需要被接住、被澄清，还是换一个角度看。
                  </div>
                </div>
                {morningStarStreamingPreview && morningStarStreamingPreview.trim() && (
                  <div
                    data-testid="morning-star-streaming-preview"
                    aria-live="polite"
                    className={`w-full max-h-48 overflow-hidden text-[11px] font-mono leading-relaxed text-left whitespace-pre-wrap p-4 border rounded-md ${theme === 'light' ? 'bg-white/60 border-slate-200 text-slate-600' : 'bg-black/40 border-cyan-900/40 text-cyan-200/80'}`}
                  >
                    {morningStarStreamingPreview.slice(-1200)}
                    <span className="inline-block w-2 h-3 ml-1 bg-cyan-400 animate-pulse align-middle" />
                  </div>
                )}
              </div>
            ) : morningStarError ? (
              <div
                className={`p-8 border flex flex-col items-center gap-4 ${theme === 'light' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/20 border-rose-900/30 text-rose-300'}`}
              >
                <AlertTriangle className="w-8 h-8" />
                <div className="text-center text-sm">{morningStarError}</div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <CyberButton onClick={handleAnalyze} theme={theme}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    {t.retry}
                  </CyberButton>
                  <CyberButton
                    variant="ghost"
                    onClick={() => setReadingStep('reflecting')}
                    theme={theme}
                  >
                    补一句后重试
                  </CyberButton>
                </div>
              </div>
            ) : parsedAnalysis ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className={`border p-8 relative overflow-hidden ${surface}`}>
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-500/40" />

                  <div
                    role="note"
                    aria-label={t.aiDisclaimerTitle ?? 'AI-generated content'}
                    className={`mb-8 flex items-start gap-3 p-3 rounded border text-[11px] leading-relaxed ${theme === 'light' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-amber-500/40 bg-amber-500/10 text-amber-100/90'}`}
                  >
                    <AlertTriangle className="w-4 h-4 mt-[2px] flex-shrink-0" />
                    <div className="flex flex-col gap-1">
                      <strong className="font-mono uppercase tracking-widest text-[10px]">
                        {t.aiDisclaimerTitle ?? 'AI-generated content'}
                      </strong>
                      <span>
                        {t.aiDisclaimerBody ??
                          'Morning Star is produced by a language model. It is not medical, legal, or financial advice. Always consult a qualified professional before acting on it.'}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`prose prose-lg max-w-none font-serif leading-relaxed relative ${theme === 'light' ? 'text-slate-800' : 'prose-invert text-cyan-50/90'}`}
                  >
                    <MessageSquareQuote className="absolute -top-6 -left-6 w-12 h-12 opacity-5" />
                    <Markdown components={markdownComponents}>{parsedAnalysis.content}</Markdown>
                  </div>
                </div>

                <div className={`border p-5 ${subtleSurface}`}>
                  <div className={`text-sm mb-4 ${primaryText}`}>这封回信之后，你想怎么继续？</div>
                  <div className="flex flex-wrap gap-3">
                    <CyberButton
                      variant="ghost"
                      onClick={() => setUnderstandingNoteOpen((open) => !open)}
                      theme={theme}
                    >
                      有点想通了
                    </CyberButton>
                    <CyberButton variant="ghost" onClick={handleAskMore} theme={theme}>
                      我还想继续问
                    </CyberButton>
                    <CyberButton variant="ghost" onClick={handleAnotherLens} theme={theme}>
                      换个角度看看
                    </CyberButton>
                    <CyberButton variant="ghost" onClick={() => setSavedSignal(true)} theme={theme}>
                      收藏这封回信
                    </CyberButton>
                  </div>

                  {understandingNoteOpen && (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={understandingNote}
                        onChange={(e) => setUnderstandingNote(e.target.value)}
                        placeholder="可选：留一句你现在明白的东西。也可以什么都不写。"
                        className={`w-full min-h-[88px] p-4 text-sm border outline-none leading-relaxed ${theme === 'light' ? 'bg-white border-slate-200 focus:border-cyan-400 text-slate-800' : 'bg-black/30 border-cyan-900/30 focus:border-cyan-500/50 text-cyan-50'}`}
                      />
                      <div className={`text-xs ${mutedText}`}>
                        这句话只属于你。启明星不会要求你把它总结成标准答案。
                      </div>
                    </div>
                  )}

                  {savedSignal && (
                    <div className={`mt-4 text-xs ${mutedText}`}>
                      已留在这篇记录里。真正值得保存的东西，慢慢会自己发光。
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className={`text-xs font-mono tracking-widest transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-cyan-800 hover:text-cyan-500'}`}
                    >
                      今天到这里就好
                    </button>
                    <CyberButton variant="danger" onClick={onDeleteAnalysis} className="text-xs">
                      <Trash2 className="w-4 h-4 mr-2" />
                      重新照见
                    </CyberButton>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="p-12 text-center border border-dashed border-cyan-900/20">
                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <div className="text-xs font-mono opacity-40 uppercase tracking-widest">
                  这封回信还没有生成
                </div>
                <CyberButton onClick={() => setReadingStep('reading')} className="mt-4">
                  回到启明星
                </CyberButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

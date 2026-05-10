import React from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BookOpen,
  Coffee,
  Coins,
  Columns,
  Library,
  MessageSquareQuote,
  RefreshCcw,
  Rocket,
  Scan,
  Star,
  Trash2,
  User,
  Wind,
  Zap,
} from 'lucide-react';
import Markdown, { Components } from 'react-markdown';
import { DiaryEntry, Theme } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import { MorningStarRadar } from './MorningStarRadar';

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
   * Falls back to the spinner when the streaming flag is off or no
   * chunks have arrived yet.
   */
  morningStarStreamingPreview?: string;
  parsedAnalysis: ParsedAnalysis | null;
  onAnalyze: () => void;
  onDeleteAnalysis: () => void;
  markdownComponents: Components;
}

const getPersonaIcon = (persona: string) => {
  switch (persona) {
    case 'Elon Musk':
      return Rocket;
    case 'Albert Camus':
      return Coffee;
    case 'Jorge Luis Borges':
      return Library;
    case 'Naval Ravikant':
      return Coins;
    case 'Marcus Aurelius':
      return Columns;
    case 'Laozi':
      return Wind;
    default:
      return Star;
  }
};

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
}) => (
  <div
    className={`mt-16 pt-12 border-t ${theme === 'light' ? 'border-[color-mix(in_srgb,_var(--color-vector-cyan-brand)_10%,_transparent)]' : 'border-cyan-900/40'}`}
  >
    {readingStep === 'reading' && (
      <div className="flex flex-col items-center gap-6 text-center">
        <div
          className={`w-16 h-16 rounded-full border flex items-center justify-center ${theme === 'light' ? 'bg-cyan-50 border-cyan-100' : 'bg-cyan-950/20 border-cyan-900/30'}`}
        >
          <BookOpen
            className={`w-8 h-8 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
          />
        </div>
        <div className="space-y-2">
          <h3
            className={`text-lg font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}
          >
            {t.reflectAndAnalyze}
          </h3>
          <p
            className={`text-xs font-mono max-w-md mx-auto opacity-60 ${theme === 'light' ? 'text-slate-600' : 'text-cyan-500'}`}
          >
            {t.reflectionStepPrompt}
          </p>
        </div>
        <CyberButton onClick={() => setReadingStep('reflecting')} theme={theme}>
          <Zap className="w-4 h-4 mr-2" />
          开启这场对话
        </CyberButton>
      </div>
    )}

    {readingStep === 'reflecting' && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-sm bg-cyan-500/10 text-cyan-400">
              <MessageSquareQuote className="w-4 h-4" />
            </div>
            <span
              className={`text-xs font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-700' : 'text-cyan-300'}`}
            >
              {t.reflectionTitle}
            </span>
          </div>

          <textarea
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            placeholder={t.reflectionPlaceholder}
            className={`w-full min-h-[160px] p-6 font-serif text-lg border transition-all outline-none leading-relaxed
              ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200 focus:border-cyan-400 text-slate-800 shadow-inner'
                  : 'bg-black/40 border-cyan-900/30 focus:border-cyan-500/50 text-cyan-50 shadow-[inset_0_0_20px_color-mix(in_srgb,_var(--color-cyan-500)_5%,_transparent)]'
              }`}
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center gap-2 font-mono text-sm uppercase tracking-widest ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-400'}`}
            >
              <Star className="w-4 h-4" /> 邀请哪颗星为你领航？
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {guidingStars.map((star) => {
              const Icon = getPersonaIcon(star);
              const isSelected = morningStarPersonas.includes(star);
              return (
                <button
                  key={star}
                  onClick={() => {
                    if (isSelected) {
                      setMorningStarPersonas(morningStarPersonas.filter((p) => p !== star));
                    } else if (morningStarPersonas.length < 3) {
                      setMorningStarPersonas([...morningStarPersonas, star]);
                    }
                  }}
                  className={`flex items-center gap-3 p-3 border transition-all duration-300
                    ${
                      isSelected
                        ? theme === 'light'
                          ? 'bg-cyan-50 border-cyan-300 text-cyan-900'
                          : 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_15px_color-mix(in_srgb,_var(--color-cyan-500)_10%,_transparent)]'
                        : theme === 'light'
                          ? 'bg-white border-slate-100 text-slate-400 hover:border-cyan-200'
                          : 'bg-black/20 border-cyan-900/20 text-cyan-700 hover:border-cyan-800'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-mono whitespace-nowrap uppercase tracking-tighter truncate">
                    {star}
                  </span>
                </button>
              );
            })}
          </div>

          {morningStarError && (
            <div
              className={`p-4 border text-sm ${theme === 'light' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/20 border-rose-900/30 text-rose-300'}`}
            >
              {morningStarError}
            </div>
          )}

          <div className="flex justify-center pt-4">
            <CyberButton
              onClick={onAnalyze}
              disabled={
                morningStarLoading || !reflectionText.trim() || morningStarPersonas.length === 0
              }
              className="min-w-[240px]"
            >
              {morningStarLoading ? (
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {t.submitReflection}
            </CyberButton>
          </div>
        </div>
      </motion.div>
    )}

    {readingStep === 'evaluation' && (
      <div className="space-y-12">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-sm bg-cyan-500/10 text-cyan-400">
                <User className="w-4 h-4" />
              </div>
              <span
                className={`text-xs font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-700' : 'text-cyan-300'}`}
              >
                {t.reflectionTitle}
              </span>
            </div>
            <button
              onClick={() => setReadingStep('reflecting')}
              className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-1 transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-cyan-600' : 'text-cyan-700 hover:text-cyan-400'}`}
            >
              <RefreshCcw className="w-3 h-3" /> 修改反思
            </button>
          </div>
          <div
            className={`p-6 border italic leading-relaxed font-serif ${theme === 'light' ? 'bg-slate-50/50 border-slate-100 text-slate-700' : 'bg-cyan-950/5 border-cyan-900/20 text-cyan-100/70'}`}
          >
            {reflectionText}
          </div>
        </div>

        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-sm bg-amber-500/10 text-amber-500">
              <Star className="w-4 h-4" />
            </div>
            <span
              className={`text-xs font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-700' : 'text-cyan-300'}`}
            >
              {t.aiEvaluation}
            </span>
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
                    {t.establishingLink}
                  </div>
                  <div className="text-[10px] font-mono opacity-40 uppercase tracking-widest">
                    星辰正在低语，请稍候...
                  </div>
                </div>
                {morningStarStreamingPreview && morningStarStreamingPreview.trim() && (
                  <div
                    data-testid="morning-star-streaming-preview"
                    aria-live="polite"
                    className={`w-full max-h-48 overflow-hidden text-[11px] font-mono leading-relaxed text-left whitespace-pre-wrap p-4 border rounded-md ${theme === 'light' ? 'bg-white/60 border-slate-200 text-slate-600' : 'bg-black/40 border-cyan-900/40 text-cyan-200/80'}`}
                  >
                    {/* Show only the tail of the stream so very long
                        responses stay legible without forcing scroll. */}
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
                  <CyberButton onClick={onAnalyze} theme={theme}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    {t.retry}
                  </CyberButton>
                  <CyberButton
                    variant="ghost"
                    onClick={() => setReadingStep('reflecting')}
                    theme={theme}
                  >
                    修改问题后重试
                  </CyberButton>
                </div>
              </div>
            ) : parsedAnalysis ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {(entry.morningStarPersonas || morningStarPersonas).map((persona, idx) => (
                      <div
                        key={persona}
                        className="w-12 h-12 rounded-full border flex items-center justify-center relative transition-transform hover:scale-110 hover:z-10 bg-black/40 border-cyan-500/20 shadow-xl"
                        style={{ zIndex: 10 - idx }}
                      >
                        {React.createElement(getPersonaIcon(persona), {
                          className: 'w-6 h-6 text-cyan-400',
                        })}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest mb-0.5">
                      视角已在此刻汇聚
                    </div>
                    <div className="text-sm font-bold tracking-widest uppercase text-white">
                      {(entry.morningStarPersonas || morningStarPersonas)
                        .map((p) => t[p.split(' ')[p.split(' ').length - 1].toLowerCase()] || p)
                        .join(' & ')}
                    </div>
                  </div>
                </div>

                <div
                  className={`border p-8 relative overflow-hidden ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-cyan-950/5 border-cyan-500/10 shadow-[0_0_40px_color-mix(in_srgb,_var(--color-cyan-500)_3%,_transparent)]'}`}
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-500/40"></div>

                  {/*
                   * AI disclaimer banner. Required by Phase 1 §1.3 — every
                   * Morning Star analysis must surface that the text is AI
                   * generated and not professional advice (EU AI Act,
                   * California SB-1001 telegraphing). Keep this above the
                   * radar / markdown so it cannot be missed.
                   */}
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

                  <div className="space-y-10">
                    {Object.keys(parsedAnalysis.metrics).length > 0 && (
                      <div
                        className={`p-4 border backdrop-blur-sm ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-black/20 border-cyan-500/5'}`}
                      >
                        <MorningStarRadar metrics={parsedAnalysis.metrics} t={t} theme={theme} />
                      </div>
                    )}

                    <div
                      className={`prose prose-lg max-w-none font-serif leading-relaxed relative ${theme === 'light' ? 'text-slate-800' : 'prose-invert text-cyan-50/90'}`}
                    >
                      <MessageSquareQuote className="absolute -top-6 -left-6 w-12 h-12 opacity-5" />
                      <Markdown components={markdownComponents}>{parsedAnalysis.content}</Markdown>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <CyberButton variant="danger" onClick={onDeleteAnalysis} className="text-xs">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t.deleteAnalysis}
                  </CyberButton>
                </div>
              </motion.div>
            ) : (
              <div className="p-12 text-center border border-dashed border-cyan-900/20">
                <div className="text-xs font-mono opacity-40 uppercase tracking-widest">
                  Calibration Data Incomplete
                </div>
                <CyberButton onClick={() => setReadingStep('reflecting')} className="mt-4">
                  重新开始反思
                </CyberButton>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
);

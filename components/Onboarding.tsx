import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Star,
  Check,
  AlertCircle,
  ArrowRight,
  Cpu,
  Key,
  Database,
  Eye,
  EyeOff,
  Globe,
} from 'lucide-react';
import { Language, Theme } from '../types';
import { NOISE_BG_STYLE } from '../lib/noiseTexture';
import { useTransientState } from '../hooks/useTransientState';
import { TRANSLATIONS, PERSONAS, GUIDING_STAR_DEFAULTS } from '../constants';
import { AppStorageKeys } from '../services/appSettings';
import { setStoredString } from '../services/browserStorage';
import { SecurityService } from '../services/securityService';
import { CyberButton } from './CyberButton';

interface OnboardingProps {
  language: Language;
  onSetLanguage: (lang: Language) => void;
  theme?: Theme;
  onComplete: (password: string, directory: string[], selection: string[]) => void;
  onCancel?: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({
  language,
  onSetLanguage,
  theme = 'dark',
  onComplete,
  onCancel,
}) => {
  const t = TRANSLATIONS[language];
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [guidingStars, setGuidingStars] = useState<string[]>(() =>
    Array.from(new Set([...GUIDING_STAR_DEFAULTS[language], ...PERSONAS])).slice(0, 3),
  );
  const [selectedStars, setSelectedStars] = useState<string[]>(() =>
    Array.from(new Set([...GUIDING_STAR_DEFAULTS[language], ...PERSONAS])).slice(0, 3),
  );
  const [customStar, setCustomStar] = useState('');
  const {
    value: error,
    setValue: setError,
    showValue: showError,
  } = useTransientState<string | null>(null);

  const [recoveryKey, setRecoveryKey] = useState('');
  const [isRecoverySaved, setIsRecoverySaved] = useState(false);

  const [showConfirmHome, setShowConfirmHome] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);

  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 8) strength += 20;
    if (/[A-Z]/.test(pass)) strength += 20;
    if (/[a-z]/.test(pass)) strength += 20;
    if (/[0-9]/.test(pass)) strength += 20;
    if (/[^a-zA-Z0-9]/.test(pass)) strength += 20;
    return strength;
  };

  const validatePassword = (pass: string) => {
    return getPasswordStrength(pass) === 100;
  };

  const generateRecoveryKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = new Uint8Array(32);
    window.crypto.getRandomValues(random);
    let result = '';
    for (let i = 0; i < 32; i++) {
      if (i > 0 && i % 8 === 0) result += '-';
      result += chars.charAt(random[i] % chars.length);
    }
    SecurityService.wipeSensitive(random);
    setRecoveryKey(result);
  };

  const handleNextStep = async () => {
    setError(null);
    if (step === 1) {
      if (!validatePassword(password)) {
        setError(t.passwordRequirement);
        return;
      }
      if (password !== confirmPassword) {
        setError(t.passwordMismatch);
        return;
      }
      generateRecoveryKey();
    }

    if (step === 2) {
      if (!isRecoverySaved) {
        setError(
          language === 'zh' ? '请核准物理备份状态' : 'Please confirm physical backup status',
        );
        return;
      }
    }

    if (step === 3) {
      const fallbackSelection =
        selectedStars.length > 0
          ? selectedStars
          : Array.from(new Set([...GUIDING_STAR_DEFAULTS[language], ...PERSONAS])).slice(0, 3);
      const fallbackDirectory =
        guidingStars.length > 0
          ? guidingStars
          : Array.from(new Set([...GUIDING_STAR_DEFAULTS[language], ...PERSONAS]));
      const recoveryHash = await SecurityService.hashRecoveryKey(recoveryKey);
      setStoredString(AppStorageKeys.recoveryVerifier, recoveryHash);
      onComplete(password, fallbackDirectory, fallbackSelection);
      return;
    }

    setStep(step + 1);
  };

  const handlePrevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const toggleStar = (star: string) => {
    if (selectedStars.includes(star)) {
      setSelectedStars(selectedStars.filter((s) => s !== star));
    } else if (selectedStars.length < 3) {
      setSelectedStars([...selectedStars, star]);
      if (!guidingStars.includes(star)) {
        setGuidingStars([...guidingStars, star]);
      }
    } else {
      showError(t.guidingStarsLimit);
    }
  };

  const handleAddCustomStar = () => {
    const trimmed = customStar.trim();
    if (!trimmed) return;

    let newDirectory = guidingStars;
    if (!guidingStars.includes(trimmed)) {
      newDirectory = [...guidingStars, trimmed];
      setGuidingStars(newDirectory);
    }

    if (!selectedStars.includes(trimmed)) {
      if (selectedStars.length < 3) {
        setSelectedStars([...selectedStars, trimmed]);
      } else {
        showError(t.guidingStarsLimit);
      }
    }

    setCustomStar('');
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl overflow-y-auto transition-colors duration-700 ${theme === 'light' ? 'bg-slate-900/40' : 'bg-black/95'}`}
    >
      {/* Phase 4.5 §D — inline noise SVG (see lib/noiseTexture.ts). */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={NOISE_BG_STYLE}></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative w-full max-w-2xl border p-8 md:p-12 shadow-xl overflow-hidden transition-all duration-700 mt-12 mb-12 ${theme === 'light' ? 'bg-white/90 backdrop-blur-2xl border-[color-mix(in_srgb,_var(--color-vector-cyan-brand)_10%,_transparent)]' : 'bg-black border-cyan-500/30'}`}
      >
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          {step === 0 && (
            <div className="relative">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className={`p-2 border transition-all rounded-sm flex items-center gap-2 font-mono text-[10px] tracking-widest ${showLangDropdown ? (theme === 'light' ? 'border-cyan-600 bg-cyan-50 text-cyan-600' : 'border-cyan-400 bg-cyan-950/50 text-white') : theme === 'light' ? 'border-slate-200 text-slate-400 hover:text-cyan-600 hover:border-cyan-300' : 'border-cyan-900/30 text-cyan-600 hover:text-white hover:border-cyan-500'}`}
              >
                <Globe className="w-4 h-4" />
                <span>{language.toUpperCase()}</span>
              </button>
              <AnimatePresence>
                {showLangDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className={`absolute top-full right-0 mt-2 w-32 border z-[100] py-1 backdrop-blur-md overflow-hidden ${theme === 'light' ? 'bg-white/90 border-slate-200 shadow-xl' : 'bg-black/95 border-cyan-500/50 shadow-2xl'}`}
                  >
                    {(['zh', 'en', 'ja', 'ko'] as Language[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          onSetLanguage(lang);
                          setShowLangDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-[10px] font-mono transition-colors flex items-center justify-between ${language === lang ? (theme === 'light' ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-500/20 text-cyan-400') : theme === 'light' ? 'text-slate-500 hover:bg-slate-50 hover:text-cyan-600' : 'text-cyan-800 hover:bg-cyan-900/30 hover:text-cyan-300'}`}
                      >
                        {lang.toUpperCase()}
                        {language === lang && <div className="w-1 h-1 bg-cyan-400 rounded-full" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Decorative Corners */}
        <div
          className={`absolute top-0 left-0 w-8 h-8 border-l-2 ${theme === 'light' ? 'border-cyan-400/30' : 'border-cyan-500/50'}`}
        ></div>
        <div
          className={`absolute top-0 right-0 w-8 h-8 border-r-2 ${theme === 'light' ? 'border-cyan-400/30' : 'border-cyan-500/50'}`}
        ></div>
        <div
          className={`absolute bottom-0 left-0 w-8 h-8 border-l-2 ${theme === 'light' ? 'border-cyan-400/30' : 'border-cyan-500/50'}`}
        ></div>
        <div
          className={`absolute bottom-0 right-0 w-8 h-8 border-r-2 ${theme === 'light' ? 'border-cyan-400/30' : 'border-cyan-500/50'}`}
        ></div>

        {/* Progress Indicator */}
        <div className="absolute top-4 left-4 flex gap-1">
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 w-8 transition-all duration-500 ${step >= s ? (theme === 'light' ? 'bg-cyan-500' : 'bg-cyan-400') : theme === 'light' ? 'bg-slate-200' : 'bg-cyan-950/30'}`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-8 mt-4">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-6"
              >
                <div
                  className={`flex items-center gap-4 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
                >
                  <Database className="w-8 h-8" />
                  <h2 className="text-2xl font-mono tracking-widest font-bold">VECTOR_OS</h2>
                </div>

                <div
                  className={`p-6 border font-mono text-sm leading-relaxed tracking-wide space-y-4 ${theme === 'light' ? 'bg-slate-50 border-cyan-100 text-vector-slate-mid' : 'bg-cyan-950/10 border-cyan-900/30 text-cyan-50'}`}
                >
                  <p>
                    {language === 'zh'
                      ? '先写下真实经历，再选一位启明星，你会收到一封更有方向感的回信。'
                      : 'Write one real experience, choose one guiding star, and receive a clearer reply.'}
                  </p>
                  <p className={theme === 'light' ? 'text-cyan-700 font-bold' : 'text-cyan-400'}>
                    {language === 'zh' ? '> 首次起航准备中...' : '> Preparing your first launch...'}
                  </p>
                  <ul
                    className={`list-disc list-inside space-y-2 text-xs ${theme === 'light' ? 'text-slate-600' : 'text-cyan-200/70'}`}
                  >
                    <li>
                      {language === 'zh'
                        ? '内容默认保存在本设备，记录属于你自己'
                        : 'Entries stay on this device by default'}
                    </li>
                    <li>
                      {language === 'zh'
                        ? '先完成第一次记录，后续再慢慢完善设置'
                        : 'Finish your first entry first, refine settings later'}
                    </li>
                    <li>
                      {language === 'zh'
                        ? '启明星和心象会在你持续记录后逐步解锁更多能力'
                        : 'Guiding stars and memoirs unlock progressively as you keep writing'}
                    </li>
                  </ul>
                  <p
                    className={`pt-4 text-xs italic ${theme === 'light' ? 'text-slate-500' : 'text-cyan-600'}`}
                  >
                    {language === 'zh'
                      ? '“过往皆为判断的注脚，诚实是对自己最深的看见”'
                      : '“Only those who enlighten themselves are unafraid of the shadows.”'}
                  </p>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-6"
              >
                <div
                  className={`flex items-center gap-4 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
                >
                  <Key className="w-6 h-6" />
                  <h2 className="text-xl font-mono uppercase tracking-widest">
                    {t.onboardingStep1 || 'SECURE VAULT INIT'}
                  </h2>
                </div>

                <div
                  className={`mb-2 p-4 text-xs font-mono border-l-2 ${theme === 'light' ? 'bg-orange-50 border-orange-400 text-orange-800' : 'bg-orange-950/20 border-orange-500/50 text-orange-200'}`}
                >
                  <AlertCircle className="w-4 h-4 mb-2 inline-block mr-2" />
                  {t.securityWarning ||
                    'WARNING: Losing this key means permanently rendering your data inaccessible.'}
                </div>

                <p
                  className={`text-sm font-mono leading-relaxed tracking-wider ${theme === 'light' ? 'text-vector-slate-mid' : 'text-cyan-700'}`}
                >
                  {t.onboardingStep1Desc}
                </p>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <label
                        className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-cyan-900'}`}
                      >
                        {t.setPass}
                      </label>
                      <div className="flex gap-1 mb-1">
                        {[20, 40, 60, 80, 100].map((lvl) => (
                          <div
                            key={lvl}
                            className={`h-1 w-4 rounded-full transition-all duration-300 ${getPasswordStrength(password) >= lvl ? (lvl <= 40 ? 'bg-rose-500 shadow-[0_0_8px_color-mix(in_srgb,_var(--color-rose-500)_30%,_transparent)]' : lvl <= 80 ? 'bg-yellow-500' : 'bg-green-500') : theme === 'light' ? 'bg-slate-100' : 'bg-cyan-950/30'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        data-testid="onboarding-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full border p-4 font-mono focus:outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-100 text-vector-ink-strong focus:border-cyan-400 placeholder:text-slate-200' : 'bg-cyan-950/20 border-cyan-900/50 text-cyan-100 focus:border-cyan-500/50 placeholder:text-cyan-900'}`}
                        placeholder="******"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:text-cyan-400 transition-colors ${theme === 'light' ? 'text-slate-300' : 'text-cyan-900'}`}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {password && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                        {[
                          { label: t.requirementLength, met: password.length >= 8 },
                          { label: t.requirementUpper, met: /[A-Z]/.test(password) },
                          { label: t.requirementLower, met: /[a-z]/.test(password) },
                          { label: t.requirementNumber, met: /[0-9]/.test(password) },
                          { label: t.requirementSpecial, met: /[^a-zA-Z0-9]/.test(password) },
                        ].map((req, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 text-[10px] font-mono ${req.met ? 'text-green-500' : 'text-slate-400'}`}
                          >
                            {req.met ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <div className="w-3 h-3 border border-current rounded-full" />
                            )}
                            {req.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-cyan-900'}`}
                    >
                      {t.confirmPassword}
                    </label>
                    <div className="relative">
                      <input
                        data-testid="onboarding-password-confirm"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full border p-4 font-mono focus:outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-100 text-vector-ink-strong focus:border-cyan-400 placeholder:text-slate-200' : 'bg-cyan-950/20 border-cyan-900/50 text-cyan-100 focus:border-cyan-500/50 placeholder:text-cyan-900'}`}
                        placeholder="******"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="stepRecovery"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-6"
              >
                <div
                  className={`flex items-center gap-4 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
                >
                  <Shield className="w-6 h-6" />
                  <h2 className="text-xl font-mono uppercase tracking-widest">
                    {t.recoveryKeyTitle}
                  </h2>
                </div>

                <p
                  className={`text-sm font-mono leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-cyan-700'}`}
                >
                  {t.recoveryKeyDesc}
                </p>

                <div
                  className={`p-6 border-2 border-dashed font-mono text-center relative ${theme === 'light' ? 'bg-slate-50 border-cyan-200 text-cyan-900' : 'bg-cyan-950/20 border-cyan-900 text-cyan-400'}`}
                >
                  <div className="text-lg tracking-widest font-bold break-all select-all">
                    {recoveryKey}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(recoveryKey);
                      // Optional: show copy success
                    }}
                    className="absolute top-2 right-2 p-1 hover:text-white transition-colors"
                  >
                    <ArrowRight className="w-4 h-4 rotate-[-45deg]" />
                  </button>
                </div>

                <div
                  data-testid="onboarding-recovery-saved"
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={isRecoverySaved}
                  onClick={() => setIsRecoverySaved(!isRecoverySaved)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    setIsRecoverySaved(!isRecoverySaved);
                  }}
                  className={`flex items-center gap-3 p-4 border cursor-pointer transition-all ${isRecoverySaved ? (theme === 'light' ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'bg-cyan-500/10 border-cyan-500 text-cyan-100') : theme === 'light' ? 'bg-white border-slate-200 text-slate-400' : 'bg-transparent border-cyan-900/40 text-cyan-900'}`}
                >
                  <div
                    className={`w-5 h-5 border flex items-center justify-center ${isRecoverySaved ? 'bg-cyan-500 border-cyan-500' : 'border-current'}`}
                  >
                    {isRecoverySaved && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="text-sm font-mono uppercase tracking-widest">
                    {t.recoveryKeySaved}
                  </span>
                </div>

                <div
                  className={`p-4 text-[10px] font-mono leading-relaxed flex gap-2 ${theme === 'light' ? 'bg-rose-50 text-rose-800 border border-rose-100' : 'bg-rose-950/20 text-rose-400/80 border border-rose-900/10'}`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {t.recoveryKeyWarning}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-6"
              >
                <div
                  className={`flex items-center justify-between gap-4 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
                >
                  <div className="flex items-center gap-4">
                    <Star className="w-6 h-6" />
                    <h2 className="text-xl font-mono uppercase tracking-widest">
                      {t.onboardingStep2 || 'GUIDING STARS'}
                    </h2>
                  </div>
                  <span
                    className={`text-xs font-mono px-3 py-1 rounded-full border transition-all ${selectedStars.length === 3 ? (theme === 'light' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-green-500/20 border-green-500 text-green-400') : theme === 'light' ? 'bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'}`}
                  >
                    {selectedStars.length} / 3
                  </span>
                </div>

                <div
                  className={`mb-2 p-4 text-xs font-mono border-l-2 ${theme === 'light' ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-blue-950/20 border-blue-500/50 text-blue-200'}`}
                >
                  <Cpu className="w-4 h-4 mb-2 inline-block mr-2" />
                  {language === 'zh'
                    ? '启明星 (Guiding Stars) 是您的精神导师阵列。系统会将您的日记进行加密预处理，结合他们的认知框架进行深度解读和回信。'
                    : 'Guiding Stars act as your spiritual mentor array. The system will analyze their cognitive frameworks to provide multi-dimensional reflections on your logged data.'}
                </div>

                <p
                  className={`text-sm font-mono leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-cyan-700'}`}
                >
                  {t.onboardingStep2Desc}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {Array.from(
                    new Set([...PERSONAS, ...GUIDING_STAR_DEFAULTS[language], ...guidingStars]),
                  ).map((persona) => {
                    const isSelected = selectedStars.includes(persona);
                    const personaKey = persona
                      .split(' ')
                      [persona.split(' ').length - 1].toLowerCase();
                    const displayName = t[personaKey] || persona;

                    return (
                      <button
                        key={persona}
                        data-testid={`onboarding-star-${personaKey}`}
                        onClick={() => toggleStar(persona)}
                        className={`
                          flex items-center justify-between p-4 border font-mono text-xs transition-all duration-300
                          ${
                            isSelected
                              ? theme === 'light'
                                ? 'bg-cyan-50/80 border-cyan-400 text-cyan-700 shadow-sm'
                                : 'bg-cyan-500/20 border-cyan-500 text-cyan-100'
                              : theme === 'light'
                                ? 'bg-white/40 border-slate-200 text-slate-400 hover:border-cyan-300 hover:text-cyan-600 hover:bg-white/60'
                                : 'bg-transparent border-cyan-900/30 text-cyan-800 hover:border-cyan-700 hover:text-cyan-400'
                          }
                        `}
                      >
                        <span className="uppercase tracking-widest">{displayName}</span>
                        {isSelected && (
                          <Check
                            className={`w-4 h-4 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customStar}
                    onChange={(e) => setCustomStar(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomStar()}
                    className={`flex-1 border p-3 font-mono text-xs focus:outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-400 placeholder:text-slate-300' : 'bg-cyan-950/20 border-cyan-900/50 text-cyan-100 focus:border-cyan-500/50 placeholder:text-cyan-900'}`}
                    placeholder={t.customStarPlaceholder || 'Enter custom star name...'}
                  />
                  <button
                    onClick={handleAddCustomStar}
                    className={`px-4 border transition-all text-xs font-mono uppercase ${theme === 'light' ? 'border-cyan-400 text-cyan-600 hover:bg-cyan-50' : 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10'}`}
                  >
                    {t.add || 'Add'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="flex items-center gap-2 text-rose-500 text-xs font-mono animate-pulse mt-2 drop-shadow-[0_0_5px_color-mix(in_srgb,_var(--color-rose-500)_30%,_transparent)]">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className={`flex ${step > 0 ? 'justify-between' : 'justify-end'} mt-8`}>
            {step > 0 && (
              <button
                data-testid="onboarding-back"
                onClick={handlePrevStep}
                className={`text-xs font-mono uppercase tracking-[0.2em] transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-700' : 'text-cyan-900 hover:text-cyan-500'}`}
              >
                {language === 'zh' ? '< 返回上一步' : '< BACK'}
              </button>
            )}

            <CyberButton
              data-testid={step === 3 ? 'onboarding-finish' : 'onboarding-next'}
              onClick={handleNextStep}
              theme={theme}
            >
              {step === 3 ? t.startJourney || 'START' : language === 'zh' ? '下一步' : 'NEXT'}{' '}
              <ArrowRight className="ml-2 w-4 h-4" />
            </CyberButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

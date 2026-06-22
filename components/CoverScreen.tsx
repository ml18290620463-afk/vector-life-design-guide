import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cpu, Scan } from 'lucide-react';
import { PRESET_PRINCIPLES, TRANSLATIONS } from '../constants';
import { NOISE_BG_STYLE } from '../lib/noiseTexture';
import { GeometricBoat } from './GeometricBoat';
import { Language, Principle, Theme } from '../types';
import { useTimeoutManager } from '../hooks/useTimeoutManager';
import { createSeededRandom } from '../lib/random';

interface CoverScreenProps {
  onStart: () => void;
  language: Language;
  principles: Principle[];
  theme?: Theme;
  /** Phase 4.5 §E — opens the cross-device migration import wizard.
   *  Visible from the cover screen so first-run users on a new
   *  device can import without first being forced to set up a
   *  master password. Optional: callers that don't pass this
   *  simply omit the CTA. */
  onMigrate?: () => void;
}

type PrincipleSource = Partial<Principle> & {
  source?: string;
  text: string;
  year?: number;
  date?: string;
};

type SignalSlotState = {
  epoch: number;
  phase: number;
};

type FateSignal = {
  key: string;
  principle: PrincipleSource;
  left: string;
  top: string;
  maxWidth: string;
  delay: string;
  duration: string;
  scale: number;
  rotate: string;
  tone: 'cyan' | 'violet';
};

export const CoverScreen: React.FC<CoverScreenProps> = ({
  onStart,
  language,
  principles,
  theme = 'dark',
  onMigrate,
}) => {
  const [isWarping, setIsWarping] = useState(false);
  const [isLaunchSliding, setIsLaunchSliding] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCustomPrinciples, setShowCustomPrinciples] = useState(false);
  const [signalSlots, setSignalSlots] = useState<SignalSlotState[]>([]);
  const [fateSeed] = useState(() => Math.random().toString(36).slice(2));
  const { scheduleTimeout } = useTimeoutManager();
  const t = TRANSLATIONS[language];
  const hasCustomPrinciples = principles.length > 0;
  const isEmptyCustomPrinciplesMode = showCustomPrinciples && !hasCustomPrinciples;
  const emptyPrinciplesQuote =
    language === 'zh'
      ? ['你的存在，值得被看见。', '此刻，或未来。终将由你刻录。']
      : [
          'Your existence deserves to be seen.',
          'In this moment, or in the future. It will one day be inscribed by you.',
        ];

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInitialize = () => {
    if (isLaunchSliding || isWarping) return;
    setIsLaunchSliding(true);
    scheduleTimeout(() => {
      setIsWarping(true);
      scheduleTimeout(() => {
        onStart();
      }, 820);
    }, 620);
  };

  const defaultSourcePrinciples = useMemo<PrincipleSource[]>(
    () => PRESET_PRINCIPLES[language] || PRESET_PRINCIPLES['en'],
    [language],
  );

  const sourcePrinciples = useMemo<PrincipleSource[]>(
    () => (showCustomPrinciples && hasCustomPrinciples ? principles : defaultSourcePrinciples),
    [defaultSourcePrinciples, hasCustomPrinciples, principles, showCustomPrinciples],
  );

  const signalLayerCount = 7;
  const signalColumnCount = 6;
  const signalSlotCount = sourcePrinciples.length * signalLayerCount;

  const getSignalSlotDuration = useCallback((slotIndex: number) => {
    const random = createSeededRandom(`signal-slot-clock-${slotIndex}`);
    const longHold = random() > 0.72;
    return longHold ? 300 + random() * 180 : 180 + random() * 160;
  }, []);

  useEffect(() => {
    setSignalSlots((current) =>
      Array.from({ length: signalSlotCount }, (_, slotIndex) => {
        const existing = current[slotIndex];
        if (existing) return existing;
        const random = createSeededRandom(`signal-slot-initial-phase-${slotIndex}`);
        const duration = getSignalSlotDuration(slotIndex);
        return {
          epoch: 0,
          phase: duration * (0.06 + random() * 0.88),
        };
      }),
    );
  }, [getSignalSlotDuration, signalSlotCount]);

  useEffect(() => {
    if (signalSlotCount === 0) return undefined;

    let cancelled = false;
    const timers: number[] = [];

    const scheduleSlot = (slotIndex: number, delaySeconds: number) => {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        setSignalSlots((current) => {
          if (!current[slotIndex]) return current;
          const next = current.slice();
          next[slotIndex] = {
            epoch: next[slotIndex].epoch + 1,
            phase: 0,
          };
          return next;
        });
        scheduleSlot(slotIndex, getSignalSlotDuration(slotIndex));
      }, delaySeconds * 1000);
      timers.push(timer);
    };

    for (let slotIndex = 0; slotIndex < signalSlotCount; slotIndex += 1) {
      const phaseRandom = createSeededRandom(`signal-slot-initial-phase-${slotIndex}`);
      const delayRandom = createSeededRandom(`signal-slot-first-update-${slotIndex}`);
      const duration = getSignalSlotDuration(slotIndex);
      const initialPhase = duration * (0.06 + phaseRandom() * 0.88);
      const delay = Math.max(18, duration - initialPhase + delayRandom() * 4);
      scheduleSlot(slotIndex, delay);
    }

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [getSignalSlotDuration, signalSlotCount]);

  const wallPalette = useMemo(
    () =>
      theme === 'light'
        ? {
            bright: ['#547f89', '#6f9da4', '#86b4bb', '#abcdd0', '#d6e8e7'],
            dim: [
              'rgba(84, 127, 137, 0.54)',
              'rgba(111, 157, 164, 0.50)',
              'rgba(134, 180, 187, 0.48)',
              'rgba(171, 205, 208, 0.46)',
              'rgba(214, 232, 231, 0.50)',
            ],
            glow: [
              'rgba(134, 180, 187, 0.12)',
              'rgba(111, 157, 164, 0.11)',
              'rgba(171, 205, 208, 0.12)',
              'rgba(214, 232, 231, 0.12)',
              'rgba(255, 255, 255, 0.16)',
            ],
          }
        : {
            bright: ['#b7f6fb', '#7e2a74', '#a64c93', '#93c5fd', '#c6befe'],
            dim: [
              'rgba(183, 246, 251, 0.74)',
              'rgba(126, 42, 116, 0.62)',
              'rgba(166, 76, 147, 0.68)',
              'rgba(147, 197, 253, 0.64)',
              'rgba(198, 190, 254, 0.72)',
            ],
            glow: [
              'rgba(63, 231, 242, 0.26)',
              'rgba(126, 42, 116, 0.22)',
              'rgba(166, 76, 147, 0.24)',
              'rgba(96, 165, 250, 0.22)',
              'rgba(123, 109, 255, 0.22)',
            ],
          },
    [theme],
  );

  const wallData = useMemo(
    () =>
      Array.from({ length: signalLayerCount }).flatMap((_, groupIndex) =>
        sourcePrinciples.map((_, principleIndex) => {
          const slotIndex = groupIndex * sourcePrinciples.length + principleIndex;
          const slotInterval = getSignalSlotDuration(slotIndex);
          const slotState = signalSlots[slotIndex] ?? { epoch: 0, phase: slotInterval * 0.5 };
          const sourceIndex =
            (principleIndex + slotState.epoch * (groupIndex + 3) + groupIndex * 5) %
            sourcePrinciples.length;
          return {
            principle: sourcePrinciples[sourceIndex],
            slotEpoch: slotState.epoch,
            slotElapsed: slotState.phase,
            slotInterval,
          };
        }),
      ),
    [getSignalSlotDuration, signalLayerCount, signalSlots, sourcePrinciples],
  );

  const wallItems = useMemo(
    () =>
      wallData.map(({ principle, slotEpoch, slotElapsed, slotInterval }, index) => {
        const key = `signal-slot-${index}`;
        const keyBase = 'id' in principle ? principle.id : principle.text;
        const random = createSeededRandom(`${keyBase}-${index}-${slotEpoch}`);
        const column = index % signalColumnCount;
        const row = Math.floor(index / signalColumnCount);
        const rowCount = Math.max(1, Math.ceil(wallData.length / signalColumnCount));
        const xNorm = (column + 0.5) / signalColumnCount;
        const yNorm = (row + 0.5) / rowCount;
        const centerDistance = Math.hypot((xNorm - 0.5) / 0.5, (yNorm - 0.5) / 0.5);
        const inCoreField = centerDistance < 0.28;
        const inTitleField = Math.abs(xNorm - 0.5) < 0.34 && yNorm > 0.38 && yNorm < 0.68;
        const edgeField = centerDistance > 0.58;
        const emphasisSeed = random();
        const emphasis: 'hero' | 'mid' | 'base' =
          edgeField && emphasisSeed > 0.982
            ? 'hero'
            : !inCoreField && !inTitleField && emphasisSeed > (edgeField ? 0.76 : 0.86)
              ? 'mid'
              : 'base';
        const offsetX = (random() - 0.5) * (emphasis === 'hero' ? 24 : emphasis === 'mid' ? 15 : 8);
        const offsetY =
          (random() - 0.5) * (emphasis === 'hero' ? 28 : emphasis === 'mid' ? 18 : 10);
        const justifySelf = random() > 0.68 ? 'center' : random() > 0.34 ? 'start' : 'end';
        const coverDarkAlpha =
          emphasis === 'hero'
            ? 0.56 + random() * 0.08
            : emphasis === 'mid'
              ? 0.34 + random() * 0.1
              : 0.14 + random() * 0.08;
        const coverDarkRgb =
          emphasis === 'hero'
            ? '143, 162, 184'
            : emphasis === 'mid'
              ? '115, 133, 154'
              : '83, 104, 127';
        const wallViolet =
          theme === 'dark' &&
          !inCoreField &&
          !inTitleField &&
          edgeField &&
          (emphasis === 'hero'
            ? random() < 0.2
            : emphasis === 'mid'
              ? random() < 0.026
              : random() < 0.002);
        const depth =
          emphasis === 'hero'
            ? 'near'
            : emphasis === 'mid'
              ? random() > 0.28
                ? 'mid'
                : 'far'
              : random() > 0.68 || inCoreField || inTitleField
                ? 'far'
                : 'mid';
        const driftDuration = 28 + random() * 30;
        const signalDuration = slotInterval;
        const signalDelay = -slotElapsed;
        const driftDelay = -(random() * driftDuration);
        const blurPx =
          depth === 'near' ? 0 : depth === 'mid' ? random() * 0.45 : 0.7 + random() * 1.15;
        const depthScale =
          depth === 'near'
            ? 1.02 + random() * 0.05
            : depth === 'mid'
              ? 0.94 + random() * 0.08
              : 0.84 + random() * 0.08;
        const itemRotate =
          emphasis === 'hero'
            ? (random() - 0.5) * 2.4
            : emphasis === 'mid'
              ? (random() - 0.5) * 4
              : (random() - 0.5) * 5.4;
        const baseAlpha =
          emphasis === 'hero'
            ? 0.62 + random() * 0.08
            : emphasis === 'mid'
              ? 0.32 + random() * 0.09
              : inCoreField || inTitleField
                ? 0.08 + random() * 0.05
                : 0.16 + random() * 0.08;
        const peakAlpha =
          emphasis === 'hero'
            ? 0.78 + random() * 0.06
            : emphasis === 'mid'
              ? 0.46 + random() * 0.1
              : inCoreField || inTitleField
                ? 0.15 + random() * 0.06
                : 0.26 + random() * 0.1;
        return {
          principle,
          emphasis,
          accentIndex: Math.floor(random() * wallPalette.bright.length),
          coverDarkRgb,
          coverDarkAlpha,
          wallViolet,
          opacity:
            emphasis === 'hero'
              ? random() * 0.08 + 0.66
              : emphasis === 'mid'
                ? random() * 0.08 + 0.44
                : random() * 0.06 + 0.24,
          columnSpan: emphasis === 'hero' ? 2 : random() > 0.82 ? 2 : 1,
          offsetX,
          offsetY,
          justifySelf,
          key,
          depth,
          driftDuration,
          driftDelay,
          signalDuration,
          signalDelay,
          blurPx,
          depthScale,
          itemRotate,
          baseAlpha,
          peakAlpha,
        };
      }),
    [signalColumnCount, wallData, wallPalette.bright.length, theme],
  );

  const fateSignals = useMemo<FateSignal[]>(() => {
    if (isEmptyCustomPrinciplesMode || sourcePrinciples.length === 0) return [];
    const random = createSeededRandom(
      `fate-signal-${language}-${fateSeed}-${sourcePrinciples.length}`,
    );
    const templates = [
      { left: '23%', top: '36%', maxWidth: 'min(33vw, 520px)' },
      { left: '53%', top: '36%', maxWidth: 'min(33vw, 520px)' },
      { left: '22%', top: '52%', maxWidth: 'min(31vw, 500px)' },
      { left: '55%', top: '52%', maxWidth: 'min(31vw, 500px)' },
      { left: '25%', top: '63%', maxWidth: 'min(34vw, 540px)' },
      { left: '51%', top: '63%', maxWidth: 'min(34vw, 540px)' },
    ];
    const count = random() > 0.62 ? 2 : 1;
    const used = new Set<number>();

    return Array.from({ length: count }, (_, signalIndex) => {
      let sourceIndex = Math.floor(random() * sourcePrinciples.length);
      while (used.has(sourceIndex) && used.size < sourcePrinciples.length) {
        sourceIndex = (sourceIndex + 1) % sourcePrinciples.length;
      }
      used.add(sourceIndex);
      const template = templates[Math.floor(random() * templates.length)];
      const leftShift = (random() - 0.5) * 2.4;
      const topShift = (random() - 0.5) * 2.2;
      const duration = 58 + random() * 30;
      const visiblePhase = duration * (0.38 + random() * 0.24);

      return {
        key: `fate-${sourceIndex}-${signalIndex}-${fateSeed}`,
        principle: sourcePrinciples[sourceIndex],
        left: `calc(${template.left} + ${leftShift.toFixed(2)}vw)`,
        top: `calc(${template.top} + ${topShift.toFixed(2)}vh)`,
        maxWidth: template.maxWidth,
        delay: `${-visiblePhase.toFixed(2)}s`,
        duration: `${duration.toFixed(2)}s`,
        scale: 0.98 + random() * 0.05,
        rotate: `${((random() - 0.5) * 2).toFixed(2)}deg`,
        tone: random() > 0.88 ? 'violet' : 'cyan',
      };
    });
  }, [fateSeed, isEmptyCustomPrinciplesMode, language, sourcePrinciples]);

  return (
    <div
      className={`cover-screen relative min-h-screen overflow-hidden flex flex-col items-center justify-center perspective-[1000px] transition-colors duration-1000 ${theme === 'light' ? 'cover-light-shell' : ''} ${
        theme === 'light'
          ? 'bg-[radial-gradient(ellipse_120%_86%_at_50%_8%,#fcfefd_0%,#f3fbfa_38%,#e8f4f3_72%,#fbfdfb_100%)]'
          : 'bg-[radial-gradient(ellipse_125%_100%_at_50%_8%,var(--color-space-layer)_0%,var(--color-space-deep)_44%,var(--color-space-bg)_100%)]'
      }`}
    >
      {/* Nebula Atmosphere Layers */}
      <div
        className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 transition-opacity duration-1000 ${isWarping ? 'opacity-0' : theme === 'dark' ? 'opacity-[0.48]' : 'opacity-100'}`}
      >
        <div
          className={`cover-nebula-a absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] rounded-full blur-[120px] mix-blend-screen animate-[nebula-drift_25s_infinite_alternate] ${theme === 'light' ? 'bg-[#d6e8e7]/18' : 'bg-cyan-950/04'}`}
        ></div>
        <div
          className={`cover-nebula-b absolute bottom-[-20%] right-[-20%] w-[80vw] h-[80vw] rounded-full blur-[120px] mix-blend-screen animate-[nebula-drift_30s_infinite_alternate_reverse] ${theme === 'light' ? 'bg-[#cfe0dc]/16' : 'bg-[#061f2e]/08'}`}
        ></div>
        <div
          className={`cover-nebula-c absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full blur-[100px] mix-blend-screen motion-safe:animate-pulse ${theme === 'light' ? 'bg-white/12' : 'bg-[#082a38]/05'}`}
        ></div>
        <div
          className={`pointer-events-none absolute inset-0 ${theme === 'light' ? '' : 'bg-[radial-gradient(ellipse_95%_60%_at_50%_108%,color-mix(in_srgb,var(--color-space-deep)_14%,transparent),transparent_55%)]'}`}
        ></div>
        <div
          className={`pointer-events-none absolute inset-0 ${theme === 'light' ? '' : 'bg-[radial-gradient(ellipse_70%_55%_at_50%_50%,transparent_20%,color-mix(in_srgb,var(--color-space-bg)_55%,transparent)_100%)]'}`}
        ></div>
        {/* Phase 4.5 §D — replaced the 3rd-party
                  `grainy-gradients.vercel.app/noise.svg` reference
                  with an inline `style={{ backgroundImage }}`
                  data-URI SVG. The previous request was on the FCP
                  critical path and added ~200ms of third-party
                  DNS+TLS+download. Inline `style` (vs Tailwind
                  arbitrary value) keeps the data-URI legible to
                  the build pipeline — Tailwind's arbitrary value
                  parser chokes on the escaped quotes inside the
                  long data URI. */}
        <div
          className={`absolute inset-0 mix-blend-soft-light ${theme === 'light' ? 'opacity-[0.055]' : 'opacity-[0.05]'}`}
          style={NOISE_BG_STYLE}
        ></div>
      </div>

      {theme === 'light' && (
        <div
          aria-hidden="true"
          className="cover-silk-ocean pointer-events-none absolute inset-0 z-[1] overflow-hidden"
        >
          <div className="cover-nacre-field absolute inset-0" />
          <div className="cover-white-hole-core absolute left-1/2 top-[48%]" />
          <div className="cover-white-hole-aperture absolute left-1/2 top-[48%]" />
          <div className="cover-white-hole-halo cover-white-hole-halo--inner absolute left-1/2 top-[48%]" />
          <div className="cover-white-hole-halo cover-white-hole-halo--outer absolute left-1/2 top-[48%]" />
          <div className="cover-pearl-sheen absolute inset-0" />
          <div className="cover-pearl-mist cover-pearl-mist--a absolute inset-0" />
          <div className="cover-pearl-mist cover-pearl-mist--b absolute inset-0" />
          <div className="cover-celadon-glaze absolute inset-0" />
          <div className="cover-celadon-craquelure absolute inset-0" />
          <div className="cover-celadon-craquelure cover-celadon-craquelure--fine absolute inset-0" />
          <div className="cover-silk-veil cover-silk-veil--back absolute inset-0" />
          <div className="cover-silk-veil cover-silk-veil--front absolute inset-0" />
          <div className="cover-silk-ribbon cover-silk-ribbon--upper" />
          <div className="cover-silk-ribbon cover-silk-ribbon--middle" />
          <div className="cover-silk-ribbon cover-silk-ribbon--lower" />
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="silk-wave-front" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
                <stop offset="28%" stopColor="rgba(248,253,252,0.62)" />
                <stop offset="48%" stopColor="rgba(160,194,194,0.10)" />
                <stop offset="72%" stopColor="rgba(238,249,247,0.30)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.14)" />
              </linearGradient>
              <linearGradient id="silk-wave-shadow" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(111,157,164,0)" />
                <stop offset="36%" stopColor="rgba(134,180,187,0.06)" />
                <stop offset="62%" stopColor="rgba(255,255,255,0.28)" />
                <stop offset="100%" stopColor="rgba(111,157,164,0)" />
              </linearGradient>
              <linearGradient id="silk-wave-ridge" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="44%" stopColor="rgba(255,255,255,0.70)" />
                <stop offset="58%" stopColor="rgba(134,180,187,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <filter id="silk-soften" x="-6%" y="-20%" width="112%" height="140%">
                <feGaussianBlur stdDeviation="10" />
              </filter>
            </defs>

            <path
              className="cover-silk-wave cover-silk-wave--slow"
              d="M-160 570 C 70 490 162 620 354 536 C 560 446 700 472 884 548 C 1076 628 1230 510 1600 572 L1600 960 L-160 960 Z"
              fill="url(#silk-wave-front)"
              opacity="0.9"
            />
            <path
              className="cover-silk-wave cover-silk-wave--mid"
              d="M-180 442 C 90 340 245 480 448 420 C 666 356 778 356 1010 454 C 1216 540 1320 402 1600 430 L1600 820 L-180 820 Z"
              fill="url(#silk-wave-shadow)"
              opacity="0.96"
              filter="url(#silk-soften)"
            />
            <path
              className="cover-silk-wave cover-silk-wave--deep"
              d="M-180 526 C 70 414 252 552 470 494 C 694 434 824 394 1048 520 C 1238 628 1398 492 1600 514 L1600 900 L-180 900 Z"
              fill="rgba(134,180,187,0.055)"
              opacity="0.9"
              filter="url(#silk-soften)"
            />
            <path
              className="cover-silk-wave cover-silk-wave--near"
              d="M-160 672 C 120 580 280 708 512 630 C 752 550 930 566 1118 650 C 1290 728 1400 626 1600 642"
              fill="none"
              stroke="url(#silk-wave-ridge)"
              strokeWidth="112"
              strokeLinecap="round"
              opacity="0.86"
              filter="url(#silk-soften)"
            />
            <path
              className="cover-silk-wave cover-silk-wave--crest"
              d="M-140 312 C 78 248 248 334 420 300 C 628 258 782 226 1004 314 C 1192 390 1336 300 1580 322"
              fill="none"
              stroke="rgba(255,255,255,0.46)"
              strokeWidth="34"
              strokeLinecap="round"
              opacity="0.72"
              filter="url(#silk-soften)"
            />
          </svg>
          <div className="cover-silk-depth absolute inset-0" />
          <div className="cover-silk-grain absolute inset-0" style={NOISE_BG_STYLE} />
        </div>
      )}

      {/* The Data Wall */}
      <div
        className={`cover-data-wall ${theme === 'light' ? 'cover-light-wall' : ''} absolute inset-[-30%] w-[170%] h-[170%] grid content-center justify-items-start auto-rows-min gap-x-8 gap-y-4 px-10 py-10
              select-none pointer-events-none z-[2]
              ${theme === 'dark' ? 'opacity-[0.84] brightness-[1.03] contrast-[1.08]' : ''}
              ${theme === 'light' ? 'opacity-[0.10] saturate-[0.32] blur-[0.95px]' : ''}
              ${isWarping ? 'animate-[warp-speed_1s_ease-in_forwards]' : ''}
            `}
        style={{
          gridTemplateColumns: `repeat(${signalColumnCount}, minmax(260px, 1fr))`,
          gridAutoFlow: 'dense',
        }}
      >
        {isEmptyCustomPrinciplesMode ? (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <div
              className={`max-w-5xl text-center font-mono leading-[1.9] tracking-[0.18em] transition-all duration-700 ${theme === 'light' ? 'text-[#4e4078]/48' : 'text-[color:var(--color-cover-status-body)]'}`}
              style={{
                fontSize: 'clamp(20px, 2.8vw, 38px)',
                textShadow:
                  theme === 'light'
                    ? '0 0 20px rgba(78,64,120,0.08)'
                    : '0 0 20px rgba(0,200,232,0.06)',
              }}
            >
              {emptyPrinciplesQuote.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        ) : (
          wallItems.map(
            ({
              principle: p,
              emphasis,
              accentIndex,
              opacity,
              columnSpan,
              offsetX,
              offsetY,
              justifySelf,
              key,
              coverDarkRgb,
              coverDarkAlpha,
              wallViolet,
              driftDuration,
              driftDelay,
              signalDuration,
              signalDelay,
              blurPx,
              depthScale,
              itemRotate,
              baseAlpha,
              peakAlpha,
            }) => {
              const isHighlight = emphasis !== 'base';
              const wallColor = isHighlight
                ? wallPalette.bright[accentIndex]
                : wallPalette.dim[accentIndex];
              const glowColor = wallPalette.glow[accentIndex];
              const fontSize =
                emphasis === 'hero'
                  ? 'clamp(18px, 1.42vw, 25px)'
                  : emphasis === 'mid'
                    ? 'clamp(13px, 1.04vw, 17px)'
                    : 'clamp(10px, 0.78vw, 12px)';
              const sourceSize =
                emphasis === 'hero' ? '12px' : emphasis === 'mid' ? '11px' : '10px';
              return (
                <div
                  key={key}
                  data-emphasis={emphasis}
                  className="cover-signal-fragment font-mono inline-flex items-baseline gap-1.5 whitespace-nowrap px-1 max-sm:max-w-[78vw] max-sm:whitespace-normal max-sm:leading-relaxed"
                  style={
                    {
                      gridColumn: `span ${columnSpan}`,
                      justifySelf,
                      transform: `translate(${offsetX}px, ${offsetY}px) rotate(${itemRotate}deg) scale(${depthScale})`,
                      opacity: theme === 'dark' ? 1 : opacity,
                      fontSize,
                      fontWeight: emphasis === 'hero' ? 700 : emphasis === 'mid' ? 600 : 500,
                      letterSpacing: emphasis === 'hero' ? '0.008em' : '0.012em',
                      color:
                        theme === 'dark'
                          ? wallViolet
                            ? 'rgba(138, 124, 255, 0.68)'
                            : `rgba(${coverDarkRgb}, ${coverDarkAlpha})`
                          : wallColor,
                      filter: `blur(${blurPx}px)`,
                      textShadow:
                        theme === 'dark'
                          ? emphasis === 'hero'
                            ? '0 0 14px rgba(0, 200, 232, 0.14), 0 0 28px rgba(123, 109, 255, 0.08)'
                            : emphasis === 'mid'
                              ? '0 0 10px rgba(0, 200, 232, 0.08)'
                              : 'none'
                          : emphasis === 'hero'
                            ? `0 0 10px ${glowColor}`
                            : emphasis === 'mid'
                              ? `0 0 6px ${glowColor}`
                              : 'none',
                      '--signal-base': baseAlpha,
                      '--signal-peak': peakAlpha,
                      '--signal-duration': `${signalDuration}s`,
                      '--signal-delay': `${signalDelay}s`,
                      '--drift-duration': `${driftDuration}s`,
                      '--drift-delay': `${driftDelay}s`,
                      '--signal-blur': `${blurPx}px`,
                    } as React.CSSProperties
                  }
                >
                  <span
                    className={`shrink-0 font-bold tracking-wider ${theme === 'light' ? 'text-[#4e4078]/36' : ''}`}
                    style={{
                      fontSize: sourceSize,
                      ...(theme === 'dark' ? { color: 'inherit' } : {}),
                    }}
                  >
                    {`【${p.source || p.date || p.year}】`}
                  </span>
                  {p.text}
                </div>
              );
            },
          )
        )}
        {!isEmptyCustomPrinciplesMode &&
          fateSignals.map((signal, signalIndex) => {
            const source =
              signal.principle.source || signal.principle.date || signal.principle.year;
            const isViolet = signal.tone === 'violet';
            return (
              <div
                key={signal.key}
                className={`cover-fate-signal absolute z-20 block leading-relaxed ${signalIndex > 0 ? 'max-md:hidden' : ''}`}
                style={
                  {
                    left: signal.left,
                    top: signal.top,
                    maxWidth: signal.maxWidth,
                    transform: `translate3d(0, 0, 0) rotate(${signal.rotate}) scale(${signal.scale})`,
                    '--fate-delay': signal.delay,
                    '--fate-duration': signal.duration,
                    '--fate-color':
                      theme === 'dark'
                        ? isViolet
                          ? 'rgba(198, 190, 254, 0.48)'
                          : 'rgba(205, 250, 252, 0.46)'
                        : isViolet
                          ? 'rgba(79, 70, 229, 0.5)'
                          : 'rgba(0, 122, 140, 0.52)',
                    '--fate-glow':
                      theme === 'dark'
                        ? isViolet
                          ? 'rgba(123, 109, 255, 0.13)'
                          : 'rgba(0, 200, 232, 0.12)'
                        : isViolet
                          ? 'rgba(123, 109, 255, 0.12)'
                          : 'rgba(0, 200, 232, 0.1)',
                  } as React.CSSProperties
                }
              >
                <span className="mr-2 font-mono text-[10px] font-medium tracking-[0.16em] text-[color:var(--fate-color)] opacity-65">
                  {`【${source}】`}
                </span>
                <span className="text-[clamp(14px,1.02vw,18px)] font-medium leading-[1.95] tracking-[0.035em] text-[color:var(--fate-color)]">
                  {signal.principle.text}
                </span>
              </div>
            );
          })}
        <div
          className={`absolute inset-0 z-10 ${theme === 'light' ? 'bg-[radial-gradient(ellipse_76%_42%_at_50%_52%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.08)_42%,transparent_68%)]' : 'bg-[radial-gradient(ellipse_38%_28%_at_50%_31%,color-mix(in_srgb,var(--color-space-bg)_78%,transparent)_0%,color-mix(in_srgb,var(--color-space-bg)_54%,transparent)_56%,transparent_100%),radial-gradient(ellipse_64%_36%_at_50%_57%,color-mix(in_srgb,var(--color-space-bg)_74%,transparent)_0%,color-mix(in_srgb,var(--color-space-bg)_48%,transparent)_48%,transparent_78%),radial-gradient(ellipse_74%_58%_at_50%_54%,color-mix(in_srgb,var(--color-space-bg)_38%,transparent)_0%,color-mix(in_srgb,var(--color-space-bg)_24%,transparent)_42%,transparent_62%,color-mix(in_srgb,var(--color-space-layer)_34%,transparent)_82%,var(--color-space-bg)_100%)]'}`}
        ></div>
      </div>

      {/* Cyber Grid Floor */}
      <div
        className={`cover-grid absolute bottom-[-30%] left-[-50%] w-[200%] h-[100%] bg-[size:50px_50px] 
              [transform:perspective(500px)_rotateX(75deg)] ${theme === 'dark' ? 'opacity-[0.12]' : 'opacity-[0.025]'} animate-[grid-move_20s_linear_infinite] pointer-events-none z-[3]
              ${
                theme === 'light'
                  ? 'bg-[linear-gradient(transparent,color-mix(in_srgb,var(--color-vector-cyan-brand)_5%,transparent)_1px,transparent_1px),linear-gradient(90deg,transparent,color-mix(in_srgb,var(--color-vector-cyan-brand)_2%,transparent)_1px,transparent_1px)]'
                  : 'bg-[linear-gradient(transparent,color-mix(in_srgb,var(--color-vector-cyan-pure)_7%,transparent)_1px,transparent_1px),linear-gradient(90deg,transparent,color-mix(in_srgb,var(--color-vector-cyan-pure)_3%,transparent)_1px,transparent_1px)]'
              }
              ${isWarping ? 'opacity-0' : ''}
            `}
      ></div>

      {/* Main UI Content */}
      <div
        className={`cover-hero-stack relative z-20 flex flex-col items-center text-center transition-all duration-700 ${mounted && !isWarping ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-110 blur-sm'}`}
      >
        <div className="cover-core-stage mb-8 relative w-56 h-56 md:w-[19.5rem] md:h-[19.5rem] flex items-center justify-center [perspective:1000px] cover-enter cover-enter--3">
          <div
            className={`cover-core-breath ${isLaunchSliding ? 'cover-core-breath--launching' : ''} absolute inset-0 border rounded-full blur-[0.5px] ${theme === 'light' ? 'border-[#86b4bb]/22 shadow-[0_0_26px_rgba(134,180,187,0.16),0_0_82px_rgba(255,255,255,0.72)]' : 'border-[color:var(--color-cover-status-rule)]/25 shadow-[0_0_20px_rgba(0,200,232,0.08)]'}`}
          ></div>
          <div
            className={`cover-core-breath ${isLaunchSliding ? 'cover-core-breath--launching' : ''} absolute inset-[28px] rounded-full pointer-events-none ${theme === 'light' ? 'bg-[radial-gradient(circle,rgba(255,255,255,0.46)_0%,rgba(134,180,187,0.10)_42%,transparent_68%)]' : 'bg-[radial-gradient(circle,rgba(0,200,232,0.14)_0%,rgba(123,109,255,0.08)_42%,transparent_68%)]'}`}
          ></div>
          <div
            className={`cover-purple-aura absolute inset-[30px] rounded-full pointer-events-none mix-blend-screen ${theme === 'light' ? 'bg-[radial-gradient(circle,rgba(134,180,187,0.14)_0%,rgba(214,232,231,0.14)_42%,transparent_72%)]' : 'bg-[radial-gradient(circle,rgba(123,109,255,0.16)_0%,rgba(123,109,255,0.08)_40%,rgba(0,200,232,0.025)_58%,transparent_74%)]'}`}
          ></div>
          {/* Layer 1 — outer grain track */}
          <div className="cover-orbit-grain absolute inset-[-14px] animate-[spin-z_200s_linear_infinite] max-md:[&>span:nth-child(odd)]:hidden pointer-events-none blur-[0.5px]">
            {Array.from({ length: 64 }).map((_, i) => {
              const angle = (i / 64) * Math.PI * 2 - Math.PI / 2;
              const x = 50 + Math.cos(angle) * 50.8;
              const y = 50 + Math.sin(angle) * 50.8;
              const size = i % 10 === 0 ? 1.05 : i % 4 === 0 ? 0.8 : 0.55;
              return (
                <span
                  key={`orbit-particle-${i}`}
                  className={`absolute rounded-full animate-[orbit-grain-twinkle_5.8s_ease-in-out_infinite] ${theme === 'light' ? 'bg-white shadow-[0_0_4px_rgba(134,180,187,0.20)]' : 'bg-cyan-100 shadow-[0_0_3px_rgba(103,232,249,0.08)]'}`}
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    left: `calc(${x}% - ${size / 2}px)`,
                    top: `calc(${y}% - ${size / 2}px)`,
                    opacity: i % 7 === 0 ? 0.2 : i % 2 === 0 ? 0.11 : 0.05,
                    animationDelay: `${(i % 10) * 0.28}s`,
                    animationDuration: `${5.2 + (i % 6) * 0.42}s`,
                  }}
                ></span>
              );
            })}
          </div>
          {/* Layer 2 — rare violet grain（#7B6DFF · 35% 体系，中央神秘感） */}
          <div className="cover-orbit-violet absolute inset-[10px] z-[1] max-md:opacity-[0.72] max-md:[&>span:nth-child(3n)]:hidden pointer-events-none mix-blend-screen">
            {Array.from({ length: 128 }).map((_, i) => {
              const angle = (i / 128) * Math.PI * 2 - Math.PI / 2;
              const x = 50 + Math.cos(angle) * 46.2;
              const y = 50 + Math.sin(angle) * 46.2;
              const size = i % 12 === 0 ? 1.35 : i % 4 === 0 ? 1.05 : 0.82;
              const isDark = theme === 'dark';
              return (
                <span
                  key={`static-violet-grain-${i}`}
                  className={`absolute rounded-full animate-[static-grain-twinkle_7.2s_ease-in-out_infinite] ${theme === 'light' ? 'bg-[#dbe9e6] shadow-[0_0_5px_rgba(134,180,187,0.18)]' : 'bg-[var(--color-cover-orbit-violet)] shadow-[0_0_5px_rgba(123,109,255,0.22)]'}`}
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    left: `calc(${x}% - ${size / 2}px)`,
                    top: `calc(${y}% - ${size / 2}px)`,
                    opacity: isDark
                      ? i % 11 === 0
                        ? 0.35
                        : i % 3 === 0
                          ? 0.2
                          : 0
                      : i % 6 === 0
                        ? 0.58
                        : i % 2 === 0
                          ? 0.38
                          : 0.24,
                    animationDelay: `${(i % 16) * 0.22}s`,
                    animationDuration: `${6.4 + (i % 5) * 0.34}s`,
                  }}
                ></span>
              );
            })}
          </div>
          {/* Layer 3 — calibration tick orbit */}
          <div className="cover-orbit-ticks absolute inset-[8px] animate-[spin-z_112s_linear_infinite] blur-[0.25px] pointer-events-none">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className={`absolute top-0 left-1/2 w-[1px] h-2.5 origin-bottom transform -translate-x-1/2 ${theme === 'light' ? 'bg-[#6f9da4]/38 shadow-[0_0_4px_rgba(134,180,187,0.18)]' : 'bg-cyan-300/12'}`}
                style={{ transform: `rotate(${i * 22.5}deg) translateY(0)` }}
              ></div>
            ))}
          </div>
          {/* Layer 4 — sweep orbit */}
          <div className="cover-orbit-sweep absolute inset-[18px] rounded-full overflow-hidden opacity-22 pointer-events-none">
            <div
              className={`absolute top-1/2 left-1/2 w-1/2 h-[1.25px] origin-left animate-[radar-spin_9s_linear_infinite] ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-[#86b4bb]/42 to-white shadow-[0_0_10px_rgba(134,180,187,0.26)]' : 'bg-gradient-to-r from-transparent via-cyan-300/16 to-cyan-200'}`}
            ></div>
          </div>
          <div
            className={`cover-orbit-tail absolute inset-[34px] rounded-full pointer-events-none ${theme === 'light' ? 'bg-[conic-gradient(from_18deg,transparent_0deg,transparent_250deg,rgba(134,180,187,0.11)_286deg,rgba(255,255,255,0.34)_318deg,transparent_352deg)]' : 'bg-[conic-gradient(from_18deg,transparent_0deg,transparent_250deg,rgba(0,200,232,0.11)_286deg,rgba(123,109,255,0.20)_318deg,transparent_352deg)]'}`}
          ></div>
          {/* Layer 4.5 — industrial hairline calibration */}
          <div className="absolute inset-[24px] rounded-full pointer-events-none opacity-70">
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={`hairline-${i}`}
                className={`absolute left-1/2 top-0 w-px origin-[50%_136px] md:origin-[50%_160px] ${i % 6 === 0 ? 'h-3' : i % 3 === 0 ? 'h-2' : 'h-1'} ${theme === 'light' ? 'bg-[#6f9da4]/26 shadow-[0_0_3px_rgba(134,180,187,0.14)]' : 'bg-cyan-100/14'}`}
                style={{
                  transform: `rotate(${i * 7.5}deg) translateX(-50%)`,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-[34px] rounded-full pointer-events-none opacity-60">
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={`micro-code-${i}`}
                className={`absolute font-mono text-[7px] tracking-[0.24em] ${theme === 'light' ? 'text-[#6f9da4]/22' : 'text-cyan-100/22'}`}
                style={{
                  left: `${50 + Math.cos((i / 8) * Math.PI * 2) * 48}%`,
                  top: `${50 + Math.sin((i / 8) * Math.PI * 2) * 48}%`,
                  transform: `translate(-50%, -50%) rotate(${i * 45}deg)`,
                }}
              >
                {`0x${(i * 17 + 42).toString(16).toUpperCase()}`}
              </span>
            ))}
          </div>
          {/* Layer 5 — primary orbit */}
          <div
            className={`cover-orbit-primary absolute z-20 inset-[40px] border-[2.5px] rounded-full animate-[spin-z_18s_linear_infinite] transition-all duration-500 pointer-events-none ${theme === 'light' ? (showCustomPrinciples ? 'border-t-white border-l-[#86b4bb]/72 border-r-[#86b4bb]/72 border-b-white shadow-[0_0_32px_rgba(134,180,187,0.28),0_0_17px_rgba(255,255,255,0.84),0_96px_48px_-44px_rgba(134,180,187,0.11)]' : 'border-t-white border-l-[#86b4bb]/56 border-r-[#86b4bb]/56 border-b-white shadow-[0_0_28px_rgba(134,180,187,0.22),0_0_15px_rgba(255,255,255,0.76),0_86px_42px_-42px_rgba(134,180,187,0.09)]') : showCustomPrinciples ? 'border-t-cyan-100 border-l-cyan-100/72 border-r-cyan-100/72 border-b-cyan-100 shadow-[0_0_40px_rgba(0,200,232,0.42),0_0_24px_rgba(0,200,232,0.22)]' : 'border-t-cyan-100 border-l-cyan-100/55 border-r-cyan-100/55 border-b-cyan-100 shadow-[0_0_32px_rgba(0,200,232,0.34),0_0_18px_rgba(0,200,232,0.16)]'}`}
          >
            <div
              className={`absolute top-0 left-1/2 w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ${theme === 'light' ? 'bg-white shadow-[0_0_16px_rgba(134,180,187,0.34),0_0_6px_rgba(255,255,255,0.95)]' : 'bg-cyan-50 shadow-[0_0_26px_rgba(0,200,232,0.55)]'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full border-[3px] border-transparent ${theme === 'light' ? 'border-t-[#6f9da4]/24 border-r-[#6f9da4]/17' : 'border-t-black/42 border-r-black/32'} opacity-80`}
            ></div>
            <div
              className={`absolute inset-[-1px] rounded-full border-[3px] border-transparent ${theme === 'light' ? 'border-b-white/88 border-l-[#dbe9e6]/72 shadow-[0_0_12px_rgba(134,180,187,0.16)]' : 'border-b-cyan-50/92 border-l-cyan-50/82 shadow-[0_0_16px_rgba(34,211,238,0.30)]'}`}
            ></div>
          </div>
          <div
            className={`cover-orbit-secondary cover-orbit-spin-x absolute z-30 inset-[60px] border-[3px] rounded-full animate-[spin-x_16s_linear_infinite] [transform-style:preserve-3d] transition-all duration-500 pointer-events-none ${theme === 'light' ? (showCustomPrinciples ? 'border-[#dbe9e6]/58 shadow-[0_0_16px_rgba(134,180,187,0.14)]' : 'border-[#dbe9e6]/42 shadow-[0_0_12px_rgba(134,180,187,0.10)]') : showCustomPrinciples ? 'border-cyan-400/28 shadow-[0_0_14px_rgba(0,200,232,0.14)]' : 'border-cyan-400/18 shadow-[0_0_10px_rgba(0,200,232,0.08)]'}`}
          >
            <div
              className={`absolute inset-0 border-t-[2px] rounded-full blur-0 transition-all duration-500 ${theme === 'light' ? (showCustomPrinciples ? 'border-t-white/70 shadow-[0_0_8px_rgba(134,180,187,0.12)]' : 'border-t-white/56 shadow-[0_0_6px_rgba(134,180,187,0.10)]') : showCustomPrinciples ? 'border-t-cyan-300/55 shadow-[0_0_8px_rgba(0,200,232,0.12)]' : 'border-t-cyan-300/38 shadow-[0_0_5px_rgba(0,200,232,0.07)]'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full border-[4px] border-transparent ${theme === 'light' ? 'border-l-[#6f9da4]/16 border-b-[#6f9da4]/10' : 'border-l-black/36 border-b-black/24'} opacity-75`}
            ></div>
            <div
              className={`absolute inset-[-0.5px] rounded-full border-[2px] border-transparent ${theme === 'light' ? 'border-t-white/56 border-r-[#dbe9e6]/50 shadow-[0_0_7px_rgba(134,180,187,0.10)]' : 'border-t-cyan-200/42 border-r-cyan-200/32 shadow-[0_0_6px_rgba(0,200,232,0.08)]'}`}
            ></div>
          </div>
          {/* spin-y 内环：色系对齐「观测系统连接」标签（浅 blue-600 / 深 cyan-300） */}
          <div
            className={`cover-orbit-secondary cover-orbit-spin-y absolute z-10 inset-[80px] border-[1.5px] rounded-full animate-[spin-y_24s_linear_infinite] [transform-style:preserve-3d] transition-all duration-500 pointer-events-none ${theme === 'light' ? (showCustomPrinciples ? 'border-[#86b4bb]/38 shadow-[0_0_15px_rgba(134,180,187,0.15)]' : 'border-[#86b4bb]/30 shadow-[0_0_11px_rgba(134,180,187,0.11)]') : showCustomPrinciples ? 'border-cyan-300/28 shadow-[0_0_14px_rgba(103,232,249,0.10)]' : 'border-cyan-300/18 shadow-[0_0_10px_rgba(103,232,249,0.07)]'}`}
          >
            <div
              className={`absolute inset-0 border-l-[3px] rounded-full transition-all duration-500 ${theme === 'light' ? (showCustomPrinciples ? 'border-l-white/70 shadow-[0_0_9px_rgba(134,180,187,0.16)]' : 'border-l-white/54 shadow-[0_0_7px_rgba(134,180,187,0.12)]') : showCustomPrinciples ? 'border-l-cyan-300/50 shadow-[0_0_14px_rgba(103,232,249,0.14)]' : 'border-l-cyan-300/36 shadow-[0_0_10px_rgba(103,232,249,0.10)]'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full border-[3px] border-transparent ${theme === 'light' ? 'border-t-[#6f9da4]/18 border-l-[#6f9da4]/14' : 'border-t-black/40 border-l-black/30'} opacity-78`}
            ></div>
            <div
              className={`absolute inset-[-1px] rounded-full border-[3px] border-transparent ${theme === 'light' ? 'border-b-[#dbe9e6]/60 border-r-white/56 shadow-[0_0_9px_rgba(134,180,187,0.11)]' : 'border-b-cyan-200/64 border-r-cyan-200/50 shadow-[0_0_12px_rgba(165,243,252,0.16)]'}`}
            ></div>
          </div>
          {/* Layer 7 — inner temporal orbit（深色仅用 #7B6DFF 轨迹，不用玫红） */}
          <div
            className={`cover-orbit-inner absolute inset-[100px] md:inset-[126px] rounded-full animate-[spin-diagonal_28s_linear_infinite] [transform-style:preserve-3d] transition-all duration-500 pointer-events-none ${theme === 'light' ? (showCustomPrinciples ? 'shadow-[0_0_14px_rgba(134,180,187,0.16)]' : 'shadow-[0_0_10px_rgba(134,180,187,0.11)]') : showCustomPrinciples ? 'shadow-[0_0_16px_rgba(123,109,255,0.2)]' : 'shadow-[0_0_12px_rgba(123,109,255,0.12)]'}`}
            style={{
              background:
                theme === 'light'
                  ? showCustomPrinciples
                    ? 'conic-gradient(from 150deg, rgba(134, 180, 187, 0.22), rgba(255, 255, 255, 0.68), rgba(214, 232, 231, 0.24), rgba(134, 180, 187, 0.20), rgba(134, 180, 187, 0.22))'
                    : 'conic-gradient(from 150deg, rgba(134, 180, 187, 0.12), rgba(255, 255, 255, 0.52), rgba(214, 232, 231, 0.18), rgba(134, 180, 187, 0.13), rgba(134, 180, 187, 0.12))'
                  : showCustomPrinciples
                    ? 'conic-gradient(from 150deg, rgba(123, 109, 255, 0.2), rgba(123, 109, 255, 0.52), rgba(123, 109, 255, 0.26), rgba(123, 109, 255, 0.44), rgba(123, 109, 255, 0.2))'
                    : 'conic-gradient(from 150deg, rgba(123, 109, 255, 0.1), rgba(123, 109, 255, 0.28), rgba(123, 109, 255, 0.14), rgba(123, 109, 255, 0.22), rgba(123, 109, 255, 0.1))',
              padding: '1.5px',
            }}
          >
            <div
              className={`absolute inset-[1.5px] rounded-full ${theme === 'light' ? 'bg-white/10' : 'bg-black/35'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full border-r-[2px] border-transparent transition-all duration-500 ${theme === 'light' ? (showCustomPrinciples ? 'border-r-white/72' : 'border-r-white/54') : showCustomPrinciples ? 'border-r-[rgba(123,109,255,0.72)]' : 'border-r-[rgba(123,109,255,0.48)]'}`}
            ></div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCustomPrinciples((prev) => !prev);
            }}
            data-testid="cover-toggle-custom-principles"
            aria-pressed={showCustomPrinciples}
            aria-label={
              language === 'zh'
                ? hasCustomPrinciples
                  ? '切换到自己设计的原则界面'
                  : '切换到存在提示界面'
                : hasCustomPrinciples
                  ? 'Switch to your custom principles view'
                  : 'Switch to the reflection prompt view'
            }
            title={
              language === 'zh'
                ? hasCustomPrinciples
                  ? '点击切换到你的原则界面'
                  : '意识通道已经开启  |  点击进入'
                : hasCustomPrinciples
                  ? 'Click to switch to your principles view'
                  : 'Click to enter the reflection prompt view'
            }
            className={`relative z-40 w-16 h-16 flex items-center justify-center transition-transform duration-300 ${hasCustomPrinciples ? 'cursor-pointer hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 focus:ring-offset-2 focus:ring-offset-[var(--color-space-bg)]' : 'cursor-pointer'} ${showCustomPrinciples ? 'scale-105' : ''}`}
          >
            <div
              className={`absolute inset-[-12px] rounded-full border transition-all duration-500 ${showCustomPrinciples ? (theme === 'light' ? 'border-[#86b4bb]/32 animate-[mode-pulse_3.1s_ease-in-out_infinite]' : 'border-cyan-300/22 animate-[mode-pulse_3.1s_ease-in-out_infinite]') : 'border-transparent'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full blur-md motion-reduce:animate-none ${theme === 'light' ? 'animate-[cover-outer-glow_5s_ease-in-out_infinite] bg-white' : 'animate-[cover-outer-glow_5s_ease-in-out_infinite] bg-[#5eeaf2]/08'}`}
            ></div>
            <div
              className={`absolute inset-[-4px] rounded-full blur-lg motion-reduce:animate-none ${theme === 'light' ? 'animate-[cover-outer-glow_4.2s_ease-in-out_infinite] bg-[#86b4bb]/16' : 'animate-[cover-outer-glow_4.2s_ease-in-out_infinite] bg-[#00c8e8]/14'}`}
            ></div>
            <div
              className={`absolute inset-0 border-2 rounded-full flex items-center justify-center transition-all duration-300 ${theme === 'light' ? (showCustomPrinciples ? 'border-[#86b4bb] bg-white/92 shadow-[0_0_24px_rgba(134,180,187,0.24),inset_0_0_18px_rgba(219,233,230,0.70)]' : 'border-[#86b4bb]/92 bg-white/90 shadow-[0_0_18px_rgba(134,180,187,0.18),inset_0_0_16px_rgba(219,233,230,0.60)]') : showCustomPrinciples ? 'border-cyan-300 bg-cyan-950/90 shadow-[0_0_24px_rgba(34,211,238,0.35)]' : 'border-white bg-black/50'}`}
            >
              <span
                className={`cover-core-scan pointer-events-none absolute inset-[7px] rounded-full ${theme === 'light' ? 'bg-[linear-gradient(180deg,transparent_0%,rgba(134,180,187,0.16)_48%,rgba(255,255,255,0.32)_51%,transparent_56%)]' : 'bg-[linear-gradient(180deg,transparent_0%,rgba(123,109,255,0.16)_47%,rgba(94,234,242,0.12)_50%,transparent_55%)]'}`}
              ></span>
              <Cpu
                className={`motion-reduce:animate-none w-8 h-8 animate-[cover-icon-breathe_4s_ease-in-out_infinite] ${theme === 'light' ? 'text-[#4d7781] drop-shadow-[0_0_10px_rgba(134,180,187,0.35)]' : showCustomPrinciples ? 'text-[color:var(--color-cover-status-title)]' : 'text-[color:var(--color-cover-cta-icon)]'}`}
              />
            </div>
          </button>
          <div className="cover-core-status cover-core-status--identity absolute left-[calc(100%+2.75rem)] top-2 flex flex-col items-start gap-2 min-w-[180px]">
            <div
              className={`flex items-center gap-2 text-xs font-mono pl-3 ${theme === 'light' ? 'text-[#547f89]/72 drop-shadow-[0_0_8px_rgba(134,180,187,0.08)]' : 'text-[color:var(--color-cover-status-title)]'}`}
            >
              <Cpu
                className={`w-4 h-4 motion-reduce:animate-none animate-[cover-icon-breathe_5s_ease-in-out_infinite] ${theme === 'light' ? 'text-[#547f89]/72' : 'text-[color:var(--color-cover-status-title)]'}`}
              />
              {language === 'zh'
                ? showCustomPrinciples
                  ? hasCustomPrinciples
                    ? '原则界面已启用'
                    : '意识空间已经开启'
                  : '认知已同步'
                : showCustomPrinciples
                  ? hasCustomPrinciples
                    ? 'Principles View Active'
                    : 'Reflection Prompt Active'
                  : 'Consciousness Synced'}
            </div>
            {hasCustomPrinciples && (
              <div
                className={`ml-6 max-w-[180px] text-[9px] font-mono uppercase tracking-[0.22em] leading-relaxed transition-all duration-300 ${theme === 'light' ? 'text-[#53607a]/58' : 'text-[color:var(--color-cover-status-body)]'} ${showCustomPrinciples ? 'opacity-100 translate-x-0' : 'opacity-60 translate-x-0'}`}
              >
                {language === 'zh'
                  ? showCustomPrinciples
                    ? '你的原则正在显现'
                    : '点击核心切换原则模式'
                  : showCustomPrinciples
                    ? 'Your principles are now visible'
                    : 'Tap the core to switch modes'}
              </div>
            )}
            {!hasCustomPrinciples && (
              <div
                className={`ml-6 max-w-[180px] text-[9px] font-mono uppercase tracking-[0.22em] leading-relaxed transition-all duration-300 ${theme === 'light' ? 'text-[#53607a]/58' : 'text-[color:var(--color-cover-status-body)]'} ${showCustomPrinciples ? 'opacity-100' : 'opacity-60'}`}
              >
                {language === 'zh'
                  ? showCustomPrinciples
                    ? '此刻，未来由你刻录'
                    : '意识通道已经开启  |  点击进入'
                  : showCustomPrinciples
                    ? 'Leave your first principle here'
                    : 'Tap the core to open the prompt'}
              </div>
            )}
          </div>
          <div className="cover-core-status cover-core-status--observation absolute right-[calc(100%+2.5rem)] bottom-2 flex flex-col items-end gap-1">
            <div
              className={`flex items-center gap-1 text-[9px] font-mono border-r-2 pr-2 pl-1 py-0.5 ${theme === 'light' ? 'text-[#547f89]/62 border-[#86b4bb]/34 bg-white/30 backdrop-blur-[2px] shadow-[0_0_8px_rgba(134,180,187,0.05)]' : 'text-[color:var(--color-cover-status-title)] border-[color:var(--color-cover-status-rule)] bg-[color-mix(in_srgb,var(--color-space-bg)_55%,transparent)] shadow-[0_0_10px_rgba(0,200,232,0.12)]'}`}
            >
              <Scan className="w-3 h-3" />{' '}
              {language === 'zh' ? '观测系统连接' : 'Observation Active'}
            </div>
          </div>
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.32]"
            viewBox="0 0 320 320"
          >
            <line
              x1="160"
              y1="160"
              x2="280"
              y2="80"
              stroke={theme === 'light' ? '#86b4bb' : 'var(--color-vector-cyan-pure)'}
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <line
              x1="160"
              y1="160"
              x2="40"
              y2="240"
              stroke={theme === 'light' ? '#dbe9e6' : '#7b6dff'}
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <circle
              cx="280"
              cy="80"
              r="2"
              fill={theme === 'light' ? '#86b4bb' : 'var(--color-vector-cyan-pure)'}
            />
            <circle
              cx="40"
              cy="240"
              r="2"
              fill={theme === 'light' ? '#dbe9e6' : '#7b6dff'}
            />
          </svg>
        </div>

        {/* Phase 4.5 §D — `font-black` (900) was being
                  synthesised by the browser because we only ship
                  Inter 400-700 in the eager bundle (latin-ext +
                  900 dropped in §D for FCP/LCP wins). The synth
                  introduced a paint delay big enough to push LCP
                  past the 90-score threshold. `font-bold` (700)
                  uses the real TTF — same heroic visual weight,
                  no paint delay. */}
        <h1
          className={`cover-title cover-enter cover-enter--1 relative z-10 text-5xl sm:text-7xl md:text-9xl font-bold tracking-[0.08em] md:tracking-[0.12em] mb-2 max-md:mix-blend-normal md:mix-blend-plus-lighter [transform:scaleX(1.045)] ${theme === 'light' ? 'text-[#303846] md:[text-shadow:0_1px_0_rgba(255,255,255,0.76),0_10px_34px_rgba(84,127,137,0.07)]' : 'text-[color:var(--color-cover-hero-title)] md:drop-shadow-[0_2px_0_rgba(123,109,255,0.22)] md:[text-shadow:0_0_20px_rgba(0,200,232,0.10),0_0_34px_rgba(123,109,255,0.12),0_8px_26px_rgba(0,0,0,0.34)]'}`}
          data-text="VECTOR"
        >
          VECTOR
        </h1>
        <div
          className={`cover-subtitle cover-enter cover-enter--2 relative z-10 flex items-center gap-4 font-bold text-xl md:text-3xl tracking-[0.5em] md:tracking-[0.54em] uppercase mb-4 ${theme === 'light' ? 'text-[#3f4b62]' : ''}`}
        >
          <span
            className={`h-[1px] w-24 md:w-36 ${theme === 'light' ? 'bg-gradient-to-l from-[#3f4b62]/28 via-[#86b4bb]/12 to-transparent' : 'bg-gradient-to-l from-[color:var(--color-cover-hero-rule)] via-[#7b6dff]/55 to-transparent shadow-[0_0_12px_rgba(0,200,232,0.26),0_0_18px_rgba(123,109,255,0.20)]'}`}
          ></span>
          <span
            className={`${theme === 'light' ? 'text-[#3f4b62]' : 'text-[color:var(--color-cover-hero-subtitle)]'}`}
          >
            {t.vectorLife}
          </span>
          <span
            className={`h-[1px] w-24 md:w-36 ${theme === 'light' ? 'bg-gradient-to-r from-[#3f4b62]/28 via-[#86b4bb]/12 to-transparent' : 'bg-gradient-to-r from-[color:var(--color-cover-hero-rule)] via-[#7b6dff]/55 to-transparent shadow-[0_0_12px_rgba(0,200,232,0.26),0_0_18px_rgba(123,109,255,0.20)]'}`}
          ></span>
        </div>
        <p
          className={`cover-narrative cover-enter cover-enter--2b relative z-10 mx-auto mb-3 flex max-w-[min(90vw,720px)] items-center justify-center px-4 text-center text-sm font-semibold leading-relaxed tracking-[0.12em] md:text-lg md:tracking-[0.18em] ${theme === 'light' ? 'text-[#57616f]' : 'text-[color:var(--color-cover-status-body)]'}`}
          aria-label={t.brandNarrative}
        >
          <span
            className={`${theme === 'light' ? 'text-[#3f4b62]/86' : 'text-cyan-100/78 drop-shadow-[0_0_10px_rgba(0,200,232,0.18)]'}`}
          >
            {language === 'zh' ? '记录 || 过去·此刻 ⇌ 未来' : 'Record || Past · Now ⇌ Future'}
          </span>
        </p>
        <div
          className={`pointer-events-none absolute left-1/2 top-[56%] h-[44%] w-[82vw] max-w-[1080px] -translate-x-1/2 -translate-y-1/2 rounded-full ${theme === 'light' ? 'bg-white/26 blur-3xl' : 'bg-[radial-gradient(ellipse_at_42%_48%,rgba(5,11,20,0.82)_0%,rgba(8,12,32,0.54)_44%,rgba(123,109,255,0.10)_66%,transparent_78%)] blur-2xl'}`}
        ></div>

        <button
          type="button"
          data-testid="cover-initialize"
          onClick={handleInitialize}
          aria-label={language === 'zh' ? '点击进入下一个界面' : 'Click to enter the next screen'}
          className={`cover-launch-tunnel cover-enter cover-enter--4 group relative z-10 mt-8 flex w-[min(82vw,480px)] items-center justify-between gap-5 px-8 py-4 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLaunchSliding ? 'cover-launch-tunnel--active pointer-events-none' : ''} ${
            theme === 'light'
              ? 'rounded-full border border-[#c9dfdc]/95 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(242,249,247,0.82)_48%,rgba(255,255,255,0.90))] backdrop-blur-xl text-[#334154] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-16px_30px_rgba(134,180,187,0.040),0_18px_54px_rgba(134,180,187,0.12),0_0_0_1px_rgba(134,180,187,0.16)] hover:-translate-y-1 hover:scale-[1.01] hover:border-[#b8d3cf]/95 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),inset_0_-16px_30px_rgba(134,180,187,0.055),0_22px_58px_rgba(134,180,187,0.15),0_0_0_1px_rgba(134,180,187,0.18)] focus:ring-[#86b4bb]/35 focus:ring-offset-[#fbfdfb]'
              : 'rounded-full border border-[color:var(--color-cover-cta-border)]/46 bg-[rgba(5,13,24,0.46)] backdrop-blur-xl hover:-translate-y-0.5 shadow-[inset_0_1px_0_0_rgba(157,246,250,0.08),inset_0_-12px_28px_rgba(123,109,255,0.055),0_12px_32px_rgba(0,0,0,0.34),0_0_14px_rgba(0,200,232,0.10),0_0_18px_rgba(123,109,255,0.08)] hover:shadow-[inset_0_1px_0_0_rgba(157,246,250,0.12),inset_0_-12px_28px_rgba(123,109,255,0.075),0_0_20px_rgba(0,200,232,0.24),0_0_16px_rgba(123,109,255,0.22)] focus:ring-[color:var(--color-cover-cta-hover-glow)]/45 focus:ring-offset-[var(--color-space-bg)]'
          }`}
        >
          <span
            className={`pointer-events-none absolute inset-0 rounded-full ${theme === 'light' ? 'opacity-90 bg-[linear-gradient(90deg,rgba(255,255,255,0.28),rgba(235,246,244,0.22),rgba(255,255,255,0.34))]' : 'opacity-80 bg-[radial-gradient(ellipse_at_center,rgba(123,109,255,0.10)_0%,rgba(0,200,232,0.055)_38%,transparent_72%)]'}`}
          ></span>
          <span
            className={`cover-tunnel-lines pointer-events-none absolute inset-x-7 inset-y-2 rounded-full border-y ${theme === 'light' ? 'border-[#86b4bb]/20' : 'border-cyan-200/14'}`}
          ></span>
          <span
            className={`cover-tunnel-depth cover-tunnel-depth--upper pointer-events-none absolute left-[24%] right-[13%] top-[38%] h-px ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-[#86b4bb]/20 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-100/16 to-[#7b6dff]/14'}`}
          ></span>
          <span
            className={`cover-tunnel-depth cover-tunnel-depth--lower pointer-events-none absolute left-[26%] right-[17%] top-[63%] h-px ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-[#dbe9e6]/16 to-transparent' : 'bg-gradient-to-r from-transparent via-[#7b6dff]/16 to-cyan-100/10'}`}
          ></span>
          <span
            className={`cover-tunnel-vanish pointer-events-none absolute left-[23%] right-[8%] top-1/2 h-px -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-r from-[#86b4bb]/10 via-[#86b4bb]/22 to-transparent' : 'bg-gradient-to-r from-cyan-200/10 via-[#7b6dff]/42 to-transparent'}`}
          ></span>
          <span
            className={`cover-tunnel-ticks pointer-events-none absolute left-[34%] right-[16%] top-1/2 h-5 -translate-y-1/2 opacity-70 ${theme === 'light' ? 'text-[#86b4bb]/22' : 'text-cyan-100/20'}`}
            aria-hidden
          >
            {Array.from({ length: 9 }).map((_, tickIndex) => (
              <span
                key={`launch-tick-${tickIndex}`}
                className={`absolute top-1/2 w-px -translate-y-1/2 ${tickIndex % 3 === 0 ? 'h-3' : 'h-2'} ${theme === 'light' ? 'bg-[#86b4bb]/22' : 'bg-cyan-100/18'}`}
                style={{ left: `${tickIndex * 12.5}%` }}
              />
            ))}
          </span>
          <span
            className={`cover-tunnel-gate cover-tunnel-gate--left pointer-events-none absolute left-4 top-1/2 h-10 w-px -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-b from-transparent via-[#86b4bb]/22 to-transparent' : 'bg-gradient-to-b from-transparent via-cyan-200/42 to-transparent'}`}
          ></span>
          <span
            className={`cover-tunnel-gate cover-tunnel-gate--right pointer-events-none absolute right-4 top-1/2 h-10 w-px -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-b from-transparent via-[#dbe9e6]/28 to-transparent' : 'bg-gradient-to-b from-transparent via-[#7b6dff]/44 to-transparent'}`}
          ></span>
          <span
            className={`cover-launch-stream pointer-events-none absolute left-14 right-12 top-1/2 h-px -translate-y-1/2 scale-x-0 ${theme === 'light' ? 'bg-gradient-to-r from-[#86b4bb]/08 via-[#86b4bb]/30 to-transparent' : 'bg-gradient-to-r from-cyan-200/12 via-[#7b6dff]/72 to-transparent'}`}
          ></span>
          <span
            className={`cover-tunnel-aperture pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-10 -translate-x-1/2 -translate-y-1/2 scale-x-0 rounded-full ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-[#86b4bb]/42 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-100/80 to-[#7b6dff]/38'}`}
          ></span>
          <span
            className={`cover-tunnel-wake pointer-events-none absolute left-10 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full opacity-0 blur-md ${theme === 'light' ? 'bg-[#86b4bb]/12' : 'bg-[#7b6dff]/16'}`}
          ></span>
          <span
            className={`pointer-events-none absolute -inset-px rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${theme === 'light' ? 'blur-md bg-[#86b4bb]/12' : 'shadow-[0_0_18px_rgba(0,200,232,0.24),0_0_10px_rgba(123,109,255,0.18)]'}`}
          ></span>
          <span
            className={`pointer-events-none absolute left-5 top-1/2 h-px w-16 -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-r from-[#86b4bb]/44 to-transparent' : 'bg-gradient-to-r from-[color:var(--color-cover-status-rule)] to-transparent'}`}
          ></span>
          <span
            className={`pointer-events-none absolute right-5 top-1/2 h-px w-16 -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-l from-[#dbe9e6]/38 to-transparent' : 'bg-gradient-to-l from-[#7b6dff]/70 to-transparent'}`}
          ></span>
          <span className="relative flex items-center gap-4">
            <span
              className={`cover-launch-thumb relative flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full ${theme === 'light' ? 'shadow-[inset_0_0_0_1px_rgba(134,180,187,0.28),0_0_0_1px_rgba(255,255,255,0.82),0_8px_28px_rgba(134,180,187,0.11)]' : 'shadow-[inset_0_0_0_1px_rgba(44,203,218,0.35),0_0_16px_rgba(0,200,232,0.15),0_4px_16px_rgba(0,0,0,0.35)]'}`}
              aria-hidden
            >
              <span
                className={`pointer-events-none absolute inset-px rounded-full ${theme === 'light' ? 'bg-[conic-gradient(from_210deg,#86b4bb_0%,transparent_32%,transparent_68%,#dbe9e6_100%)] opacity-[0.15]' : 'bg-[conic-gradient(from_200deg,rgba(94,234,242,0.35)_0%,transparent_38%,transparent_62%,rgba(0,200,232,0.28)_100%)] opacity-[0.2]'}`}
              />
              <span
                className={`pointer-events-none absolute inset-[6px] md:inset-[7px] rounded-full ${theme === 'light' ? 'bg-white/84' : 'bg-[linear-gradient(165deg,rgba(8,22,38,0.92)_0%,rgba(5,13,24,0.88)_100%)]'}`}
              />
              <span
                className={`pointer-events-none absolute inset-[6px] md:inset-[7px] rounded-full border ${theme === 'light' ? 'border-[#86b4bb]/26' : 'border-[color:var(--color-cover-cta-border)]/35'}`}
              />
              <GeometricBoat
                variant="hero"
                theme={theme}
                className={`relative z-[1] h-6 w-6 md:h-7 md:w-7 animate-[cover-boat-float_2.8s_ease-in-out_infinite] motion-reduce:animate-none ${theme === 'light' ? 'text-[#334154] drop-shadow-[0_0_9px_rgba(134,180,187,0.18)]' : 'text-[color:var(--color-cover-cta-icon)] drop-shadow-[0_0_10px_rgba(0,200,232,0.25)]'}`}
              />
            </span>
            <span
              className={`cover-launch-label relative flex min-w-[156px] items-center justify-center text-[12px] md:text-sm font-mono uppercase tracking-[0.28em] md:tracking-[0.34em] ${theme === 'light' ? 'text-[#334154]/95' : 'text-[color:var(--color-cover-cta-label)]'}`}
            >
              <span
                className={`cover-label-pulse pointer-events-none absolute left-1/2 top-1/2 h-px w-20 -translate-x-1/2 -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-[#86b4bb]/18 to-transparent' : 'bg-gradient-to-r from-transparent via-[#7b6dff]/28 to-transparent'}`}
              ></span>
              {language === 'zh' ? '接入矢量空间' : 'Enter Vector Space'}
            </span>
          </span>
        </button>
      </div>

      {isWarping && (
        <div
          className={`absolute inset-0 opacity-0 animate-[flash_1.2s_ease-in-out_forwards] pointer-events-none z-50 ${theme === 'light' ? 'bg-vector-fog-light' : 'bg-white'}`}
        ></div>
      )}

      <style>{`
              @keyframes cover-enter-fade-up {
                from { opacity: 0; transform: translateY(16px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .cover-enter {
                animation: cover-enter-fade-up 0.88s cubic-bezier(0.22, 1, 0.36, 1) both;
              }
              .cover-enter--1 { animation-delay: 0.08s; }
              .cover-enter--2 { animation-delay: 0.18s; }
              .cover-enter--2b { animation-delay: 0.24s; }
              .cover-enter--3 { animation-delay: 0.3s; }
              .cover-enter--4 { animation-delay: 0.44s; }
              .cover-enter--5 { animation-delay: 0.56s; }
              .cover-silk-ocean {
                background:
                  radial-gradient(circle at 50% 46%, rgba(255,255,255,0.99) 0%, rgba(251,254,253,0.95) 22%, rgba(232,244,242,0.30) 48%, transparent 72%),
                  radial-gradient(ellipse 92% 52% at 50% 35%, rgba(249,253,252,0.72), rgba(213,232,229,0.18) 54%, transparent 82%),
                  linear-gradient(180deg, rgba(253,254,253,0.99), rgba(240,248,246,0.62) 42%, rgba(229,241,239,0.34) 74%, rgba(251,253,251,0.82)),
                  radial-gradient(ellipse 118% 72% at 50% 104%, rgba(154,190,190,0.07), transparent 72%);
              }
              .cover-nacre-field {
                background:
                  radial-gradient(ellipse 34% 16% at 32% 24%, rgba(255,255,255,0.28), transparent 74%),
                  radial-gradient(ellipse 30% 14% at 72% 34%, rgba(214,232,231,0.12), transparent 76%),
                  radial-gradient(ellipse 38% 18% at 44% 76%, rgba(247,253,252,0.18), transparent 78%),
                  linear-gradient(112deg, rgba(255,255,255,0), rgba(255,255,255,0.26) 34%, rgba(205,226,223,0.06) 52%, rgba(255,255,255,0.20) 68%, rgba(255,255,255,0));
                filter: blur(42px);
                opacity: 0.58;
                mix-blend-mode: screen;
                will-change: transform;
              }
              .cover-white-hole-core {
                width: min(44vw, 590px);
                aspect-ratio: 1;
                border-radius: 999px;
                background:
                  radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(250,253,252,0.90) 28%, rgba(214,232,231,0.22) 52%, rgba(255,255,255,0) 74%),
                  radial-gradient(circle, rgba(111,157,164,0.07), transparent 70%);
                box-shadow:
                  inset 0 0 80px rgba(255,255,255,0.90),
                  0 0 96px rgba(255,255,255,0.72),
                  0 0 176px rgba(111,157,164,0.07);
                filter: blur(12px);
                opacity: 0.68;
                transform: translate3d(-50%, -50%, 0);
                will-change: transform;
              }
              .cover-white-hole-aperture {
                width: min(26vw, 360px);
                aspect-ratio: 1;
                border-radius: 999px;
                background:
                  radial-gradient(circle, rgba(255,255,255,0.94) 0%, rgba(250,253,252,0.68) 34%, rgba(111,157,164,0.055) 58%, transparent 74%);
                box-shadow:
                  inset 0 0 28px rgba(255,255,255,0.92),
                  0 0 44px rgba(248,250,250,0.62);
                filter: blur(6px);
                opacity: 0.62;
                transform: translate3d(-50%, -50%, 0);
                will-change: transform;
              }
              .cover-white-hole-halo {
                border-radius: 999px;
                transform: translate3d(-50%, -50%, 0);
                pointer-events: none;
                will-change: transform;
              }
              .cover-white-hole-halo--inner {
                width: min(60vw, 790px);
                aspect-ratio: 1;
                border: 1px solid rgba(134,180,187,0.10);
                background: radial-gradient(circle, transparent 50%, rgba(134,180,187,0.10) 60%, transparent 75%);
                filter: blur(10px);
                opacity: 0.30;
              }
              .cover-white-hole-halo--outer {
                width: min(82vw, 1060px);
                aspect-ratio: 1;
                background:
                  radial-gradient(circle, transparent 48%, rgba(134,180,187,0.07) 59%, rgba(255,255,255,0.24) 66%, transparent 80%);
                filter: blur(24px);
                opacity: 0.26;
              }
              .cover-pearl-sheen {
                background:
                  linear-gradient(118deg, transparent 0%, rgba(255,255,255,0.48) 18%, transparent 36%, rgba(134,180,187,0.055) 50%, rgba(239,248,246,0.34) 64%, transparent 84%),
                  linear-gradient(64deg, rgba(255,255,255,0.18), rgba(134,180,187,0.045), rgba(239,248,246,0.15));
                mix-blend-mode: screen;
                animation: none;
                will-change: transform, opacity;
              }
              .cover-pearl-mist {
                background:
                  radial-gradient(ellipse 58% 13% at 42% 48%, rgba(255,255,255,0.36), transparent 76%),
                  radial-gradient(ellipse 64% 16% at 58% 52%, rgba(134,180,187,0.07), transparent 78%);
                filter: blur(34px);
                opacity: 0.38;
                mix-blend-mode: screen;
                will-change: transform;
              }
              .cover-pearl-mist--b {
                background:
                  radial-gradient(ellipse 70% 15% at 50% 44%, rgba(255,255,255,0.32), transparent 74%),
                  radial-gradient(ellipse 54% 12% at 46% 60%, rgba(134,180,187,0.08), transparent 76%);
                opacity: 0.30;
              }
              .cover-celadon-glaze {
                background:
                  linear-gradient(116deg, transparent 4%, rgba(255,255,255,0.24) 20%, rgba(255,255,255,0.04) 34%, rgba(214,232,231,0.12) 48%, rgba(255,255,255,0.34) 66%, transparent 86%),
                  radial-gradient(ellipse 74% 42% at 52% 36%, rgba(255,255,255,0.22), transparent 70%),
                  radial-gradient(ellipse 82% 46% at 46% 76%, rgba(134,180,187,0.06), transparent 74%);
                filter: blur(14px);
                opacity: 0.64;
                mix-blend-mode: screen;
              }
              .cover-celadon-craquelure {
                background-image:
                  linear-gradient(27deg, transparent 0 18%, rgba(84,127,137,0.13) 18.16%, rgba(255,255,255,0.14) 18.34%, transparent 18.82% 46%, rgba(255,255,255,0.28) 46.18%, rgba(84,127,137,0.07) 46.36%, transparent 46.9% 100%),
                  linear-gradient(96deg, transparent 0 24%, rgba(84,127,137,0.09) 24.16%, rgba(255,255,255,0.12) 24.34%, transparent 24.86% 55%, rgba(255,255,255,0.22) 55.18%, rgba(111,157,164,0.06) 55.36%, transparent 55.9% 100%),
                  linear-gradient(151deg, transparent 0 13%, rgba(111,157,164,0.095) 13.16%, rgba(255,255,255,0.12) 13.34%, transparent 13.82% 38%, rgba(255,255,255,0.20) 38.18%, transparent 38.82% 100%);
                background-size: 340px 248px, 400px 286px, 485px 326px;
                background-position: 5% 8%, 72% 18%, 36% 74%;
                -webkit-mask-image: radial-gradient(ellipse 80% 64% at 50% 48%, rgba(0,0,0,0.82), rgba(0,0,0,0.42) 56%, transparent 86%);
                mask-image: radial-gradient(ellipse 80% 64% at 50% 48%, rgba(0,0,0,0.82), rgba(0,0,0,0.42) 56%, transparent 86%);
                opacity: 0.48;
                filter: blur(0.18px);
                mix-blend-mode: multiply;
              }
              .cover-celadon-craquelure--fine {
                background-image:
                  linear-gradient(42deg, transparent 0 31%, rgba(84,127,137,0.075) 31.12%, rgba(255,255,255,0.08) 31.3%, transparent 31.62% 100%),
                  linear-gradient(128deg, transparent 0 22%, rgba(255,255,255,0.20) 22.12%, rgba(111,157,164,0.05) 22.32%, transparent 22.62% 100%),
                  linear-gradient(7deg, transparent 0 61%, rgba(111,157,164,0.065) 61.12%, rgba(255,255,255,0.08) 61.3%, transparent 61.58% 100%);
                background-size: 190px 170px, 240px 210px, 280px 230px;
                background-position: 12% 18%, 58% 44%, 82% 76%;
                -webkit-mask-image: radial-gradient(ellipse 86% 70% at 50% 52%, rgba(0,0,0,0.68), rgba(0,0,0,0.30) 58%, transparent 88%);
                mask-image: radial-gradient(ellipse 86% 70% at 50% 52%, rgba(0,0,0,0.68), rgba(0,0,0,0.30) 58%, transparent 88%);
                opacity: 0.34;
                filter: blur(0.08px);
                mix-blend-mode: multiply;
              }
              .cover-silk-veil {
                background:
                  linear-gradient(108deg, transparent 6%, rgba(255,255,255,0.30) 26%, rgba(134,180,187,0.045) 44%, rgba(241,249,247,0.22) 62%, transparent 88%);
                filter: blur(30px);
                mix-blend-mode: screen;
                opacity: 0.22;
                transform: translate3d(0, 0, 0) rotate(-7deg) scale(1.12);
                will-change: transform;
              }
              .cover-silk-veil--front {
                background:
                  linear-gradient(74deg, transparent 10%, rgba(255,255,255,0.26) 31%, rgba(134,180,187,0.05) 48%, rgba(243,250,248,0.20) 64%, transparent 86%);
                opacity: 0.18;
                filter: blur(36px);
                transform: translate3d(0, 0, 0) rotate(6deg) scale(1.16);
              }
              .cover-silk-ribbon {
                position: absolute;
                left: -18vw;
                right: -18vw;
                height: 24vh;
                border-radius: 999px;
                background:
                  linear-gradient(96deg, rgba(255,255,255,0.02), rgba(255,255,255,0.44) 26%, rgba(134,180,187,0.035) 50%, rgba(242,250,248,0.34) 72%, rgba(134,180,187,0.035)),
                  linear-gradient(180deg, rgba(255,255,255,0.34), rgba(134,180,187,0.020), rgba(242,250,248,0.24));
                box-shadow:
                  inset 0 18px 42px rgba(255,255,255,0.58),
                  inset 0 -24px 54px rgba(134,180,187,0.022),
                  0 32px 82px rgba(134,180,187,0.022);
                filter: blur(38px);
                mix-blend-mode: screen;
                opacity: 0.24;
                transform: translate3d(0, 0, 0) rotate(-2deg);
                will-change: transform;
              }
              .cover-silk-ribbon--upper {
                top: 31vh;
                animation: silk-current-upper 18s ease-in-out infinite alternate;
              }
              .cover-silk-ribbon--middle {
                top: 46vh;
                height: 30vh;
                opacity: 0.40;
                transform: translate3d(0, 0, 0) rotate(0.9deg);
                animation: silk-current-middle 22s ease-in-out infinite alternate;
              }
              .cover-silk-ribbon--lower {
                top: 64vh;
                height: 24vh;
                opacity: 0.32;
                transform: translate3d(0, 0, 0) rotate(-0.8deg);
                animation: silk-current-lower 20s ease-in-out infinite alternate;
              }
              .cover-silk-depth {
                background:
                  radial-gradient(ellipse 74% 36% at 50% 62%, rgba(134,180,187,0.035), transparent 64%),
                  radial-gradient(ellipse 72% 34% at 50% 30%, rgba(255,255,255,0.64), transparent 66%),
                  linear-gradient(180deg, rgba(255,255,255,0.44), transparent 46%, rgba(134,180,187,0.035));
                mix-blend-mode: screen;
                opacity: 0.36;
              }
              .cover-silk-grain {
                opacity: 0.032;
                mix-blend-mode: multiply;
              }
              .cover-silk-wave {
                transform-box: fill-box;
                transform-origin: center;
                will-change: transform, opacity;
              }
              .cover-silk-wave--slow {
                animation: silk-wave-roll-slow 24s ease-in-out infinite alternate;
              }
              .cover-silk-wave--mid {
                animation: silk-wave-roll-mid 19s ease-in-out infinite alternate;
              }
              .cover-silk-wave--deep {
                animation: silk-wave-roll-deep 21s ease-in-out infinite alternate;
              }
              .cover-silk-wave--near {
                animation: silk-wave-roll-near 14s ease-in-out infinite alternate;
              }
              .cover-silk-wave--crest {
                animation: silk-wave-roll-crest 17s ease-in-out infinite alternate;
              }
              .cover-light-shell .cover-nebula-a,
              .cover-light-shell .cover-nebula-b,
              .cover-light-shell .cover-nebula-c,
              .cover-light-shell .cover-pearl-sheen,
              .cover-light-shell .cover-silk-wave,
              .cover-light-shell .cover-grid,
              .cover-light-shell .cover-core-breath,
              .cover-light-shell .cover-purple-aura,
              .cover-light-shell .cover-orbit-tail,
              .cover-light-shell .cover-core-scan,
              .cover-light-shell .cover-orbit-grain,
              .cover-light-shell .cover-orbit-violet,
              .cover-light-shell .cover-orbit-ticks,
              .cover-light-shell .cover-orbit-sweep,
              .cover-light-shell .cover-orbit-primary,
              .cover-light-shell .cover-orbit-spin-x,
              .cover-light-shell .cover-orbit-spin-y,
              .cover-light-shell .cover-orbit-inner,
              .cover-light-shell .cover-launch-tunnel,
              .cover-light-shell .cover-label-pulse,
              .cover-light-shell .cover-tunnel-depth,
              .cover-light-shell .cover-tunnel-ticks {
                animation: none !important;
              }
              .cover-light-shell .cover-orbit-grain span,
              .cover-light-shell .cover-orbit-violet span {
                animation: none !important;
              }
              .cover-light-shell .cover-pearl-sheen {
                opacity: 0.48 !important;
              }
              .cover-light-shell .cover-silk-wave--slow {
                opacity: 0.42 !important;
                transform: translate3d(0, 0, 0) scaleX(1.03);
              }
              .cover-light-shell .cover-silk-wave--mid {
                opacity: 0.34 !important;
                transform: translate3d(0, 0, 0) scaleX(1.05);
              }
              .cover-light-shell .cover-silk-wave--deep {
                opacity: 0.36 !important;
                transform: translate3d(0, 0, 0) scaleX(1.06);
              }
              .cover-light-shell .cover-silk-wave--near {
                opacity: 0.38 !important;
                transform: translate3d(0, 0, 0) scaleX(1.04);
              }
              .cover-light-shell .cover-silk-wave--crest {
                opacity: 0.28 !important;
                transform: translate3d(0, 0, 0) scaleX(1.02);
              }
              .cover-light-wall .cover-signal-fragment {
                animation: none !important;
                opacity: 0.09 !important;
                filter: blur(0.9px) saturate(0.36) !important;
                text-shadow: none !important;
              }
              .cover-light-wall .cover-fate-signal {
                animation: none !important;
                opacity: 0.08 !important;
                filter: blur(0.9px) saturate(0.36) !important;
                text-shadow: none !important;
              }
              .cover-signal-fragment {
                animation: signal-breathe var(--signal-duration) ease-in-out var(--signal-delay) infinite;
                opacity: var(--signal-base);
                will-change: opacity, filter;
              }
	              .cover-fate-signal {
	                animation: fate-signal-resonance var(--fate-duration) ease-in-out var(--fate-delay) infinite;
	                color: var(--fate-color);
	                opacity: 0.42;
	                filter: blur(0.25px);
	                text-shadow: 0 0 12px var(--fate-glow), 0 10px 30px rgba(0, 0, 0, 0.18);
	                will-change: opacity, filter;
	              }
              .cover-core-breath {
                animation: core-breath 5.8s ease-in-out infinite;
                will-change: opacity, filter, transform;
              }
              .cover-core-breath--launching {
                animation: cover-core-launch 0.72s cubic-bezier(0.16, 0.82, 0.2, 1) both;
              }
              .cover-purple-aura {
                animation: purple-aura-breath 6.4s ease-in-out infinite;
                will-change: opacity, filter, transform;
              }
              .cover-orbit-tail {
                animation: orbit-tail-drift 18s linear infinite;
                filter: blur(0.35px);
              }
              .cover-core-scan {
                animation: core-scan 3.7s ease-in-out infinite;
                opacity: 0.34;
              }
              .cover-launch-tunnel {
                isolation: isolate;
                --launch-travel: min(calc(78vw - 112px), 328px);
                animation: launch-system-breath 5.4s ease-in-out infinite;
              }
              .cover-launch-tunnel:hover,
              .cover-launch-tunnel--active {
                animation-play-state: paused;
              }
              .cover-launch-tunnel::before {
                content: "";
                position: absolute;
                inset: -18px;
                z-index: -1;
                border-radius: 999px;
                background: radial-gradient(ellipse at center, rgba(94, 234, 242, 0.16), transparent 68%);
                opacity: 0.12;
                filter: blur(18px);
                transform: scaleX(0.72);
                transition: opacity 0.38s ease, transform 0.48s ease, filter 0.48s ease;
              }
              .cover-launch-tunnel:hover::before,
              .cover-launch-tunnel--active::before {
                opacity: 0.46;
                filter: blur(20px);
                transform: scaleX(1.02) scaleY(1.16);
              }
              .cover-narrative-arrow {
                position: relative;
              }
              .cover-narrative-arrow::after {
                content: "";
                position: absolute;
                right: -1px;
                top: 50%;
                width: 6px;
                height: 6px;
                border-right: 1px solid currentColor;
                border-top: 1px solid currentColor;
                transform: translateY(-50%) rotate(45deg);
                opacity: 0.72;
              }
              .cover-launch-thumb,
              .cover-launch-label,
              .cover-label-pulse,
              .cover-launch-stream,
              .cover-tunnel-aperture,
              .cover-tunnel-gate,
              .cover-tunnel-wake,
              .cover-tunnel-depth,
              .cover-tunnel-ticks {
                will-change: transform, opacity, filter;
              }
              .cover-label-pulse {
                animation: launch-label-pulse 4.8s ease-in-out infinite;
              }
              .cover-tunnel-depth {
                animation: launch-depth-breathe 5.8s ease-in-out infinite;
              }
              .cover-tunnel-depth--lower {
                animation-delay: -2.2s;
              }
              .cover-tunnel-ticks {
                animation: launch-ticks-breathe 6.5s ease-in-out infinite;
              }
              .cover-launch-tunnel--active .cover-launch-thumb {
                animation: launch-thumb-slide 0.72s cubic-bezier(0.2, 0.82, 0.18, 1) forwards;
              }
              .cover-launch-tunnel--active .cover-launch-label {
                animation: launch-label-release 0.52s ease forwards;
              }
              .cover-launch-tunnel--active .cover-launch-stream {
                animation: launch-stream-open 0.72s cubic-bezier(0.18, 0.78, 0.2, 1) forwards;
                transform-origin: left center;
              }
              .cover-launch-tunnel--active .cover-tunnel-aperture {
                animation: launch-aperture-open 0.82s cubic-bezier(0.16, 0.82, 0.2, 1) forwards;
              }
              .cover-launch-tunnel--active .cover-tunnel-wake {
                animation: launch-wake-travel 0.72s cubic-bezier(0.2, 0.82, 0.18, 1) forwards;
              }
              .cover-launch-tunnel--active .cover-tunnel-gate--left {
                animation: launch-gate-left 0.72s cubic-bezier(0.2, 0.82, 0.18, 1) forwards;
              }
              .cover-launch-tunnel--active .cover-tunnel-gate--right {
                animation: launch-gate-right 0.72s cubic-bezier(0.2, 0.82, 0.18, 1) forwards;
              }
              .cover-launch-tunnel--active {
                transform: translateY(-1px);
              }
              .cover-launch-tunnel--active::after {
                content: "";
                position: absolute;
                inset: -42px;
                z-index: -1;
                border-radius: 999px;
                border: 1px solid rgba(126, 239, 255, 0.34);
                animation: launch-system-pulse 0.82s cubic-bezier(0.16, 0.82, 0.2, 1) forwards;
              }
              .cover-tunnel-lines::before,
              .cover-tunnel-lines::after {
                content: "";
                position: absolute;
                inset: 7px 28px;
                border-top: 1px solid rgba(94, 234, 242, 0.16);
                border-bottom: 1px solid rgba(123, 109, 255, 0.16);
                transform: perspective(160px) rotateX(58deg) scaleX(0.72);
                transform-origin: center;
              }
              .cover-tunnel-lines::after {
                inset: 13px 62px;
                opacity: 0.72;
                transform: perspective(160px) rotateX(58deg) scaleX(0.45);
              }
              .cover-tunnel-ticks span {
                transform-origin: center;
              }
              @media (prefers-reduced-motion: reduce) {
                .cover-enter {
                  animation: none !important;
                  opacity: 1 !important;
                  transform: none !important;
                }
                .cover-data-wall {
                  animation: none !important;
                  transform: none !important;
                }
                .cover-nebula-a,
                .cover-nebula-b {
                  animation: none !important;
                }
                .cover-nebula-c {
                  animation: none !important;
                  opacity: 0.35 !important;
                }
                .cover-orbit-grain,
                .cover-orbit-violet,
                .cover-orbit-ticks,
                .cover-orbit-sweep,
                .cover-orbit-primary,
                .cover-orbit-spin-x,
                .cover-orbit-spin-y,
                .cover-orbit-inner {
                  animation: none !important;
                }
                .cover-purple-aura,
                .cover-orbit-tail,
                .cover-core-scan,
                .cover-tunnel-lines {
                  animation: none !important;
                }
                .cover-core-breath {
                  animation: none !important;
                }
                .cover-grid {
                  animation: none !important;
                }
	                .cover-signal-fragment {
	                  animation: none !important;
	                }
	                .cover-fate-signal {
	                  animation: none !important;
	                  opacity: 0.56 !important;
	                }
	              }
	              @media (max-width: 767px) {
	                .cover-fate-signal {
	                  left: 10% !important;
	                  top: 18% !important;
	                  max-width: 76vw !important;
	                  transform: none !important;
	                  opacity: 0.1 !important;
	                  filter: blur(1px) brightness(0.62) !important;
	                }
	                .cover-fate-signal span:last-child {
	                  font-size: 13px !important;
	                  line-height: 1.95;
	                }
	              }
	              @keyframes fate-signal-resonance {
	                0% { opacity: 0.28; filter: blur(0.62px) brightness(0.82); }
	                18% { opacity: 0.36; filter: blur(0.42px) brightness(0.9); }
	                42% { opacity: 0.56; filter: blur(0.12px) brightness(1.03); }
	                58% { opacity: 0.64; filter: blur(0px) brightness(1.08); }
	                78% { opacity: 0.5; filter: blur(0.16px) brightness(0.98); }
	                100% { opacity: 0.28; filter: blur(0.62px) brightness(0.82); }
	              }
              @keyframes silk-sheen-drift {
                0% { transform: translate3d(-3%, -1%, 0) scale(1.02); opacity: 0.62; }
                48% { transform: translate3d(2%, 1%, 0) scale(1.05); opacity: 0.9; }
                100% { transform: translate3d(4%, -2%, 0) scale(1.03); opacity: 0.72; }
              }
              @keyframes silk-wave-roll-slow {
                0% { transform: translate3d(-2.6%, 1.2%, 0) scaleX(1.03) scaleY(0.98); opacity: 0.78; }
                50% { transform: translate3d(1.4%, -1.2%, 0) scaleX(1.07) scaleY(1.02); opacity: 0.96; }
                100% { transform: translate3d(3.2%, 0.8%, 0) scaleX(1.02) scaleY(1); opacity: 0.84; }
              }
              @keyframes silk-wave-roll-mid {
                0% { transform: translate3d(2.8%, -1.6%, 0) scaleX(1.08); opacity: 0.54; }
                52% { transform: translate3d(-2.4%, 0.8%, 0) scaleX(1.02); opacity: 0.84; }
                100% { transform: translate3d(-4%, -0.4%, 0) scaleX(1.06); opacity: 0.62; }
              }
              @keyframes silk-wave-roll-deep {
                0% { transform: translate3d(-2%, 1.6%, 0) scaleX(1.06) scaleY(1.02); opacity: 0.74; }
                50% { transform: translate3d(2.8%, -1.2%, 0) scaleX(1.11) scaleY(0.98); opacity: 0.96; }
                100% { transform: translate3d(4.2%, 0.4%, 0) scaleX(1.04) scaleY(1.03); opacity: 0.78; }
              }
              @keyframes silk-wave-roll-near {
                0% { transform: translate3d(-4%, 0.8%, 0) scaleX(1.08); opacity: 0.52; }
                46% { transform: translate3d(1.8%, -1.3%, 0) scaleX(1.02); opacity: 0.82; }
                100% { transform: translate3d(4.4%, 0.3%, 0) scaleX(1.1); opacity: 0.58; }
              }
              @keyframes silk-wave-roll-crest {
                0% { transform: translate3d(3.2%, -0.8%, 0) scaleX(1.04); opacity: 0.46; }
                50% { transform: translate3d(-2.2%, 1.1%, 0) scaleX(1.08); opacity: 0.72; }
                100% { transform: translate3d(-3.6%, -0.2%, 0) scaleX(1.03); opacity: 0.52; }
              }
              @keyframes silk-current-upper {
                0% { transform: translate3d(-1.2vw, 0.28vh, 0) rotate(-1.5deg) scaleX(1.02); }
                100% { transform: translate3d(1.1vw, -0.34vh, 0) rotate(-0.9deg) scaleX(1.04); }
              }
              @keyframes silk-current-middle {
                0% { transform: translate3d(1vw, -0.2vh, 0) rotate(0.9deg) scaleX(1.03); }
                100% { transform: translate3d(-1.4vw, 0.42vh, 0) rotate(0.35deg) scaleX(1.01); }
              }
              @keyframes silk-current-lower {
                0% { transform: translate3d(-0.9vw, 0, 0) rotate(-0.7deg) scaleX(1.01); }
                100% { transform: translate3d(1.3vw, -0.32vh, 0) rotate(-1.1deg) scaleX(1.04); }
              }
              @keyframes white-hole-breathe {
                0%, 100% { transform: translate3d(-50%, -50%, 0) scale(0.985); }
                50% { transform: translate3d(-50%, -50%, 0) scale(1.018); }
              }
              @keyframes white-hole-aperture-breathe {
                0%, 100% { transform: translate3d(-50%, -50%, 0) scale(0.97); }
                50% { transform: translate3d(-50%, -50%, 0) scale(1.012); }
              }
              @keyframes white-hole-halo-drift {
                0% { transform: translate3d(-50%, -50%, 0) rotate(0deg) scale(0.99); }
                100% { transform: translate3d(-50%, -50%, 0) rotate(14deg) scale(1.015); }
              }
              @keyframes nacre-field-drift {
                0% { transform: translate3d(-0.8vw, 0, 0) scale(1.01); }
                100% { transform: translate3d(0.9vw, -0.28vh, 0) scale(1.025); }
              }
              @keyframes pearl-mist-drift-a {
                0% { transform: translate3d(-1.2vw, 0.2vh, 0) scale(1); }
                100% { transform: translate3d(1.4vw, -0.4vh, 0) scale(1.025); }
              }
              @keyframes pearl-mist-drift-b {
                0% { transform: translate3d(1.1vw, -0.2vh, 0) scale(1.015); }
                100% { transform: translate3d(-1.3vw, 0.44vh, 0) scale(1); }
              }
              @keyframes silk-veil-drift-back {
                0% { transform: translate3d(-0.6vw, 0.2vh, 0) rotate(-7deg) scale(1.12); }
                100% { transform: translate3d(0.8vw, -0.2vh, 0) rotate(-6.2deg) scale(1.14); }
              }
              @keyframes silk-veil-drift-front {
                0% { transform: translate3d(0.6vw, -0.12vh, 0) rotate(6deg) scale(1.16); }
                100% { transform: translate3d(-0.8vw, 0.22vh, 0) rotate(5.2deg) scale(1.14); }
              }
	              @keyframes signal-breathe {
                0% { opacity: 0.01; filter: blur(calc(var(--signal-blur) + 1.15px)) brightness(0.56); }
                9% { opacity: 0.014; filter: blur(calc(var(--signal-blur) + 1.02px)) brightness(0.6); }
                22% { opacity: calc(var(--signal-base) * 0.58); filter: blur(calc(var(--signal-blur) + 0.32px)) brightness(0.86); }
                34% { opacity: var(--signal-base); filter: blur(var(--signal-blur)) brightness(1); }
                50% { opacity: var(--signal-peak); filter: blur(var(--signal-blur)) brightness(1.12); }
                68% { opacity: var(--signal-peak); filter: blur(var(--signal-blur)) brightness(1.1); }
                80% { opacity: calc(var(--signal-base) * 0.78); filter: blur(calc(var(--signal-blur) + 0.12px)) brightness(0.98); }
                90% { opacity: calc(var(--signal-base) * 0.34); filter: blur(calc(var(--signal-blur) + 0.52px)) brightness(0.76); }
                95% { opacity: 0.018; filter: blur(calc(var(--signal-blur) + 1px)) brightness(0.62); }
                100% { opacity: 0.01; filter: blur(calc(var(--signal-blur) + 1.15px)) brightness(0.56); }
              }
              @keyframes core-breath {
                0%, 100% { opacity: 0.46; filter: blur(0.5px) brightness(0.92); transform: scale(0.985); }
                48% { opacity: 0.86; filter: blur(0.35px) brightness(1.12); transform: scale(1.018); }
                68% { opacity: 0.58; filter: blur(0.45px) brightness(1); transform: scale(1.002); }
              }
              @keyframes cover-core-launch {
                0% { opacity: 0.56; filter: blur(0.4px) brightness(1); transform: scale(0.99); }
                34% { opacity: 0.92; filter: blur(0.18px) brightness(1.18); transform: scale(1.028); }
                72% { opacity: 0.48; filter: blur(1.4px) brightness(1.08); transform: scale(1.14); }
                100% { opacity: 0.12; filter: blur(4px) brightness(0.82); transform: scale(1.34); }
              }
              @keyframes purple-aura-breath {
                0%, 100% { opacity: 0.28; filter: blur(10px) saturate(1); transform: scale(0.96); }
                48% { opacity: 0.58; filter: blur(13px) saturate(1.2); transform: scale(1.025); }
                72% { opacity: 0.4; filter: blur(11px) saturate(1.08); transform: scale(1.005); }
              }
              @keyframes orbit-tail-drift {
                0% { transform: rotate(0deg); opacity: 0.34; }
                50% { opacity: 0.56; }
                100% { transform: rotate(360deg); opacity: 0.34; }
              }
              @keyframes core-scan {
                0%, 100% { transform: translateY(-8px) scaleX(0.86); opacity: 0; }
                32% { opacity: 0.34; }
                52% { transform: translateY(8px) scaleX(1.02); opacity: 0.22; }
                72% { opacity: 0; }
              }
              @keyframes scroll-wall {
                0% { transform: perspective(1000px) rotateX(15deg) rotateZ(-5deg) translateY(0); }
                50% { transform: perspective(1000px) rotateX(15deg) rotateZ(-5deg) translateY(-10%); }
                100% { transform: perspective(1000px) rotateX(15deg) rotateZ(-5deg) translateY(-20%); }
              }
              @keyframes warp-speed {
                0% { transform: perspective(1000px) rotateX(15deg) rotateZ(-5deg) translateY(0) scale(1); opacity: 0.8; }
                100% { transform: perspective(1000px) rotateX(0deg) rotateZ(0deg) translateY(-50%) scale(5); opacity: 0; filter: blur(20px); }
              }
              @keyframes grid-move {
                 0% { background-position: 0 0; }
                 100% { background-position: 0 50px; }
              }
              @keyframes flash {
                0% { opacity: 0; }
                40% { opacity: 0.9; }
                100% { opacity: 1; background: ${theme === 'light' ? 'var(--color-vector-fog-light)' : 'var(--color-space-bg)'}; }
              }
              @keyframes nebula-drift {
                 0% { transform: translate(0, 0) scale(1); opacity: 0.26; }
                 100% { transform: translate(5%, 10%) scale(1.1); opacity: 0.40; }
              }
              @keyframes spin-z { 0% { transform: rotateZ(0deg); } 100% { transform: rotateZ(360deg); } }
              @keyframes spin-x { 0% { transform: rotateX(0deg) rotateZ(0deg); } 50% { transform: rotateX(180deg) rotateZ(180deg); } 100% { transform: rotateX(360deg) rotateZ(360deg); } }
              @keyframes spin-y { 0% { transform: rotateY(0deg) rotateZ(45deg); } 100% { transform: rotateY(360deg) rotateZ(45deg); } }
              @keyframes spin-diagonal {
                0% { transform: rotateX(62deg) rotateY(0deg) rotateZ(18deg); }
                100% { transform: rotateX(62deg) rotateY(360deg) rotateZ(18deg); }
              }
              @keyframes radar-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              @keyframes song-observer-primary {
                0% { transform: rotateZ(-7deg) scale(1); opacity: 0.92; filter: brightness(0.98); }
                18% { transform: rotateZ(18deg) scale(1.004); opacity: 1; filter: brightness(1.04); }
                42% { transform: rotateZ(64deg) scale(1.002); opacity: 0.96; filter: brightness(1.01); }
                58% { transform: rotateZ(92deg) scale(1.006); opacity: 1; filter: brightness(1.06); }
                82% { transform: rotateZ(146deg) scale(1.002); opacity: 0.95; filter: brightness(1); }
                100% { transform: rotateZ(173deg) scale(1); opacity: 0.92; filter: brightness(0.98); }
              }
              @keyframes song-observer-tilt-x {
                0%, 100% { transform: rotateX(2deg) rotateZ(-4deg) scale(1); opacity: 0.72; }
                36% { transform: rotateX(13deg) rotateZ(5deg) scale(1.006); opacity: 0.88; }
                64% { transform: rotateX(-6deg) rotateZ(11deg) scale(1.002); opacity: 0.76; }
              }
              @keyframes song-observer-tilt-y {
                0%, 100% { transform: rotateY(44deg) rotateZ(42deg) scale(1); opacity: 0.68; }
                45% { transform: rotateY(60deg) rotateZ(52deg) scale(1.004); opacity: 0.84; }
                72% { transform: rotateY(34deg) rotateZ(47deg) scale(1.002); opacity: 0.74; }
              }
              @keyframes song-observer-inner {
                0%, 100% { transform: rotateX(62deg) rotateY(-12deg) rotateZ(16deg) scale(0.996); opacity: 0.78; }
                48% { transform: rotateX(62deg) rotateY(32deg) rotateZ(20deg) scale(1.008); opacity: 0.94; }
              }
              @keyframes song-observer-sweep {
                0% { transform: rotate(0deg); opacity: 0; filter: blur(0.8px); }
                8% { opacity: 0.16; filter: blur(0.35px); }
                38% { opacity: 0.42; filter: blur(0.08px); }
                48% { opacity: 0.64; filter: blur(0); }
                58% { opacity: 0.18; filter: blur(0.45px); }
                74% { opacity: 0; filter: blur(0.9px); }
                100% { transform: rotate(360deg); opacity: 0; filter: blur(0.9px); }
              }
              @keyframes song-core-breath {
                0%, 100% { opacity: 0.48; filter: blur(0.48px) brightness(0.98); transform: scale(0.992); }
                38% { opacity: 0.66; filter: blur(0.24px) brightness(1.06); transform: scale(1.01); }
                62% { opacity: 0.58; filter: blur(0.34px) brightness(1.02); transform: scale(1.002); }
              }
              @keyframes song-aura-breath {
                0%, 100% { opacity: 0.34; filter: blur(12px) saturate(0.92); transform: scale(0.982); }
                50% { opacity: 0.50; filter: blur(15px) saturate(1.02); transform: scale(1.018); }
              }
              @keyframes song-tail-drift {
                0% { transform: rotate(-8deg) scale(0.998); opacity: 0.28; filter: blur(0.2px); }
                48% { transform: rotate(42deg) scale(1.006); opacity: 0.44; filter: blur(0); }
                100% { transform: rotate(82deg) scale(1); opacity: 0.30; filter: blur(0.2px); }
              }
              @keyframes song-particle-twinkle {
                0%, 100% { opacity: 0.06; transform: scale(0.94); }
                36% { opacity: 0.20; transform: scale(1.05); }
                72% { opacity: 0.10; transform: scale(0.98); }
              }
              @keyframes song-icon-focus {
                0%, 100% { opacity: 0.90; transform: scale(1); filter: drop-shadow(0 0 6px rgba(134,180,187,0.22)); }
                42% { opacity: 1; transform: scale(1.025); filter: drop-shadow(0 0 11px rgba(134,180,187,0.38)); }
              }
              @keyframes cover-boat-float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-2.5px); }
              }
              @keyframes launch-thumb-slide {
                0% {
                  transform: translateX(0) scale(1);
                  filter: brightness(1);
                }
                52% {
                  transform: translateX(calc(var(--launch-travel) * 0.72)) scale(0.96);
                  filter: brightness(1.22) drop-shadow(0 0 14px rgba(123, 109, 255, 0.38));
                }
                100% {
                  transform: translateX(var(--launch-travel)) scale(0.9);
                  opacity: 0.34;
                  filter: brightness(1.35) drop-shadow(0 0 20px rgba(0, 200, 232, 0.48)) drop-shadow(0 0 16px rgba(123, 109, 255, 0.42));
                }
              }
              @keyframes launch-label-release {
                0% { opacity: 1; transform: translateX(0); letter-spacing: 0.44em; }
                100% { opacity: 0.46; transform: translateX(14px); letter-spacing: 0.56em; }
              }
              @keyframes launch-label-pulse {
                0%, 100% { opacity: 0.22; transform: translate(-50%, -50%) scaleX(0.56); filter: blur(0.2px); }
                48% { opacity: 0.52; transform: translate(-50%, -50%) scaleX(1); filter: blur(0.45px); }
              }
              @keyframes launch-system-breath {
                0%, 100% { filter: brightness(1); }
                50% { filter: brightness(1.06); }
              }
              @keyframes launch-system-pulse {
                0% { opacity: 0.72; transform: scale(0.72); filter: blur(0); }
                72% { opacity: 0.18; transform: scale(1.24); filter: blur(2px); }
                100% { opacity: 0; transform: scale(1.36); filter: blur(5px); }
              }
              @keyframes launch-depth-breathe {
                0%, 100% { opacity: 0.42; transform: scaleX(0.86); filter: blur(0.15px); }
                50% { opacity: 0.76; transform: scaleX(1); filter: blur(0); }
              }
              @keyframes launch-ticks-breathe {
                0%, 100% { opacity: 0.38; filter: blur(0.1px); }
                46% { opacity: 0.74; filter: blur(0); }
              }
              @keyframes launch-stream-open {
                0% { opacity: 0; transform: translateY(-50%) scaleX(0); filter: blur(0); }
                38% { opacity: 0.82; transform: translateY(-50%) scaleX(0.7); filter: blur(0.2px); }
                100% { opacity: 0.18; transform: translateY(-50%) scaleX(1); filter: blur(1.2px); }
              }
              @keyframes launch-aperture-open {
                0% { opacity: 0; transform: translate(-50%, -50%) scaleX(0); filter: blur(0); }
                42% { opacity: 0; transform: translate(-50%, -50%) scaleX(0.08); filter: blur(0); }
                74% { opacity: 0.92; transform: translate(-50%, -50%) scaleX(5.8); filter: blur(0.25px); box-shadow: 0 0 16px rgba(0, 200, 232, 0.42), 0 0 22px rgba(123, 109, 255, 0.28); }
                100% { opacity: 0.18; transform: translate(-50%, -50%) scaleX(7.2); filter: blur(1.2px); box-shadow: 0 0 24px rgba(0, 200, 232, 0.28), 0 0 30px rgba(123, 109, 255, 0.22); }
              }
              @keyframes launch-wake-travel {
                0% { opacity: 0; transform: translate(0, -50%) scale(0.72); filter: blur(8px); }
                38% { opacity: 0.48; transform: translate(calc(var(--launch-travel) * 0.42), -50%) scale(1); filter: blur(10px); }
                100% { opacity: 0.1; transform: translate(var(--launch-travel), -50%) scale(0.65); filter: blur(14px); }
              }
              @keyframes launch-gate-left {
                0% { opacity: 0.42; transform: translateY(-50%) scaleY(1); filter: blur(0); }
                44% { opacity: 0.92; transform: translateY(-50%) scaleY(1.3); filter: blur(0.2px); }
                100% { opacity: 0.18; transform: translateY(-50%) translateX(-8px) scaleY(0.76); filter: blur(1px); }
              }
              @keyframes launch-gate-right {
                0% { opacity: 0.42; transform: translateY(-50%) scaleY(1); filter: blur(0); }
                44% { opacity: 0.96; transform: translateY(-50%) scaleY(1.38); filter: blur(0.2px); }
                100% { opacity: 0.22; transform: translateY(-50%) translateX(8px) scaleY(0.78); filter: blur(1px); }
              }
              @keyframes orbit-grain-twinkle {
                0%, 100% { opacity: 0.08; transform: scale(0.96); }
                45% { opacity: 0.28; transform: scale(1.04); }
                70% { opacity: 0.14; transform: scale(1); }
              }
              @keyframes static-grain-twinkle {
                0%, 100% { opacity: 0.2; transform: scale(0.98); }
                50% { opacity: 0.5; transform: scale(1.03); }
              }
              @keyframes mode-pulse {
                0%, 100% { transform: scale(0.98); opacity: 0.28; }
                50% { transform: scale(1.04); opacity: 0.62; }
              }
              @keyframes cover-outer-glow {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 0.88; }
              }
              @keyframes cover-icon-breathe {
                0%, 100% { opacity: 0.88; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.03); }
              }
              .cover-light-shell,
              .cover-light-shell *,
              .cover-light-shell *::before,
              .cover-light-shell *::after {
                animation: none !important;
              }
              .cover-light-shell .cover-silk-ribbon--upper {
                animation: silk-current-upper 18s ease-in-out infinite alternate !important;
              }
              .cover-light-shell .cover-silk-ribbon--middle {
                animation: silk-current-middle 22s ease-in-out infinite alternate !important;
              }
              .cover-light-shell .cover-silk-ribbon--lower {
                animation: silk-current-lower 20s ease-in-out infinite alternate !important;
              }
              .cover-light-shell .cover-nacre-field {
                animation: nacre-field-drift 52s ease-in-out infinite alternate !important;
              }
              .cover-light-shell .cover-white-hole-core {
                animation: white-hole-breathe 24s ease-in-out infinite !important;
              }
              .cover-light-shell .cover-white-hole-aperture {
                animation: white-hole-aperture-breathe 18s ease-in-out infinite !important;
              }
              .cover-light-shell .cover-white-hole-halo--inner {
                animation: white-hole-halo-drift 42s ease-in-out infinite alternate !important;
              }
              .cover-light-shell .cover-white-hole-halo--outer {
                animation: white-hole-halo-drift 58s ease-in-out infinite alternate-reverse !important;
              }
              .cover-light-shell .cover-pearl-mist--a {
                animation: pearl-mist-drift-a 36s ease-in-out infinite alternate !important;
              }
              .cover-light-shell .cover-pearl-mist--b {
                animation: pearl-mist-drift-b 44s ease-in-out infinite alternate !important;
              }
              .cover-light-shell .cover-silk-veil--back {
                animation: silk-veil-drift-back 48s ease-in-out infinite alternate !important;
              }
	              .cover-light-shell .cover-silk-veil--front {
	                animation: silk-veil-drift-front 40s ease-in-out infinite alternate !important;
	              }
	              .cover-light-shell .cover-core-breath {
	                animation: song-core-breath 5.8s ease-in-out infinite !important;
	              }
	              .cover-light-shell .cover-core-breath:nth-child(2) {
	                animation-delay: -2.1s !important;
	              }
	              .cover-light-shell .cover-purple-aura {
	                animation: song-aura-breath 6.4s ease-in-out infinite !important;
	              }
	              .cover-light-shell .cover-orbit-tail {
	                animation: orbit-tail-drift 18s linear infinite !important;
	              }
	              .cover-light-shell .cover-orbit-grain {
	                animation: spin-z 200s linear infinite !important;
	              }
	              .cover-light-shell .cover-orbit-violet {
	                animation: spin-z 200s linear infinite reverse !important;
	              }
	              .cover-light-shell .cover-orbit-grain span,
	              .cover-light-shell .cover-orbit-violet span {
	                animation: song-particle-twinkle 5.8s ease-in-out infinite !important;
	              }
	              .cover-light-shell .cover-orbit-primary {
	                animation: spin-z 18s linear infinite !important;
	              }
	              .cover-light-shell .cover-orbit-spin-x {
	                animation: spin-x 16s linear infinite !important;
	              }
	              .cover-light-shell .cover-orbit-spin-y {
	                animation: spin-y 24s linear infinite !important;
	              }
	              .cover-light-shell .cover-orbit-inner {
	                animation: spin-inner 24s linear infinite !important;
	              }
	              .cover-light-shell .cover-orbit-ticks {
	                animation: spin-z 112s linear infinite !important;
	              }
	              .cover-light-shell .cover-orbit-sweep > div {
	                animation: radar-spin 9s linear infinite !important;
	              }
	              .cover-light-shell .cover-core-scan {
	                animation: core-scan 3.7s ease-in-out infinite !important;
	              }
	              .cover-light-shell [data-testid="cover-toggle-custom-principles"] svg {
	                animation: none !important;
	                filter: drop-shadow(0 0 9px rgba(134,180,187,0.34)) !important;
	              }
            `}</style>
    </div>
  );
};

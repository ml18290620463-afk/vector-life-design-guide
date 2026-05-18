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
            bright: ['#00c8e8', '#7e2a74', '#a64c93', '#3b82f6', '#9d8fff'],
            dim: [
              'rgba(0, 200, 232, 0.72)',
              'rgba(126, 42, 116, 0.62)',
              'rgba(166, 76, 147, 0.66)',
              'rgba(59, 130, 246, 0.64)',
              'rgba(157, 143, 255, 0.68)',
            ],
            glow: [
              'rgba(63, 231, 242, 0.26)',
              'rgba(126, 42, 116, 0.22)',
              'rgba(166, 76, 147, 0.24)',
              'rgba(59, 130, 246, 0.22)',
              'rgba(123, 109, 255, 0.24)',
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
      className={`relative min-h-screen overflow-hidden flex flex-col items-center justify-center perspective-[1000px] transition-colors duration-1000 ${
        theme === 'light'
          ? 'bg-vector-fog-light'
          : 'bg-[radial-gradient(ellipse_125%_100%_at_50%_8%,var(--color-space-layer)_0%,var(--color-space-deep)_44%,var(--color-space-bg)_100%)]'
      }`}
    >
      {/* Nebula Atmosphere Layers */}
      <div
        className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 transition-opacity duration-1000 ${isWarping ? 'opacity-0' : theme === 'dark' ? 'opacity-[0.48]' : 'opacity-100'}`}
      >
        <div
          className={`cover-nebula-a absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] rounded-full blur-[120px] mix-blend-screen animate-[nebula-drift_25s_infinite_alternate] ${theme === 'light' ? 'bg-cyan-200/20' : 'bg-cyan-950/04'}`}
        ></div>
        <div
          className={`cover-nebula-b absolute bottom-[-20%] right-[-20%] w-[80vw] h-[80vw] rounded-full blur-[120px] mix-blend-screen animate-[nebula-drift_30s_infinite_alternate_reverse] ${theme === 'light' ? 'bg-blue-200/20' : 'bg-[#061f2e]/08'}`}
        ></div>
        <div
          className={`cover-nebula-c absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full blur-[100px] mix-blend-screen motion-safe:animate-pulse ${theme === 'light' ? 'bg-cyan-100/10' : 'bg-[#082a38]/05'}`}
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
          className={`absolute inset-0 mix-blend-soft-light ${theme === 'light' ? 'opacity-[0.09]' : 'opacity-[0.05]'}`}
          style={NOISE_BG_STYLE}
        ></div>
      </div>

      {/* The Data Wall */}
      <div
        className={`cover-data-wall absolute inset-[-30%] w-[170%] h-[170%] grid content-center justify-items-start auto-rows-min gap-x-8 gap-y-4 px-10 py-10
              select-none pointer-events-none z-0
              ${theme === 'dark' ? 'opacity-[0.84] brightness-[1.03] contrast-[1.08]' : ''}
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
              className={`max-w-5xl text-center font-mono leading-[1.9] tracking-[0.18em] transition-all duration-700 ${theme === 'light' ? 'text-vector-cyan-brand/60' : 'text-[color:var(--color-cover-status-body)]'}`}
              style={{
                fontSize: 'clamp(20px, 2.8vw, 38px)',
                textShadow:
                  theme === 'light'
                    ? '0 0 20px rgba(20,184,230,0.08)'
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
                    className={`shrink-0 font-bold tracking-wider ${theme === 'light' ? 'text-vector-cyan-brand/42' : ''}`}
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
          className={`absolute inset-0 z-10 ${theme === 'light' ? 'bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--color-vector-fog-light)_38%,transparent)_0%,color-mix(in_srgb,var(--color-vector-fog-light)_22%,transparent)_34%,transparent_58%,var(--color-vector-fog-light)_95%)]' : 'bg-[radial-gradient(ellipse_38%_28%_at_50%_31%,color-mix(in_srgb,var(--color-space-bg)_78%,transparent)_0%,color-mix(in_srgb,var(--color-space-bg)_54%,transparent)_56%,transparent_100%),radial-gradient(ellipse_64%_36%_at_50%_57%,color-mix(in_srgb,var(--color-space-bg)_74%,transparent)_0%,color-mix(in_srgb,var(--color-space-bg)_48%,transparent)_48%,transparent_78%),radial-gradient(ellipse_74%_58%_at_50%_54%,color-mix(in_srgb,var(--color-space-bg)_38%,transparent)_0%,color-mix(in_srgb,var(--color-space-bg)_24%,transparent)_42%,transparent_62%,color-mix(in_srgb,var(--color-space-layer)_34%,transparent)_82%,var(--color-space-bg)_100%)]'}`}
        ></div>
      </div>

      {/* Cyber Grid Floor */}
      <div
        className={`cover-grid absolute bottom-[-30%] left-[-50%] w-[200%] h-[100%] bg-[size:50px_50px] 
              [transform:perspective(500px)_rotateX(75deg)] ${theme === 'dark' ? 'opacity-[0.12]' : 'opacity-[0.22]'} animate-[grid-move_20s_linear_infinite] pointer-events-none z-0
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
        className={`relative z-20 flex flex-col items-center text-center transition-all duration-700 ${mounted && !isWarping ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-110 blur-sm'}`}
      >
        <div className="mb-8 relative w-56 h-56 md:w-[19.5rem] md:h-[19.5rem] flex items-center justify-center [perspective:1000px] cover-enter cover-enter--3">
          <div
            className={`cover-core-breath ${isLaunchSliding ? 'cover-core-breath--launching' : ''} absolute inset-0 border rounded-full blur-[0.5px] ${theme === 'light' ? 'border-cyan-300/07 shadow-[0_0_10px_rgba(34,211,238,0.03)]' : 'border-[color:var(--color-cover-status-rule)]/25 shadow-[0_0_20px_rgba(0,200,232,0.08)]'}`}
          ></div>
          <div
            className={`cover-core-breath ${isLaunchSliding ? 'cover-core-breath--launching' : ''} absolute inset-[28px] rounded-full pointer-events-none ${theme === 'light' ? 'bg-[radial-gradient(circle,rgba(34,211,238,0.12)_0%,transparent_66%)]' : 'bg-[radial-gradient(circle,rgba(0,200,232,0.14)_0%,rgba(123,109,255,0.08)_42%,transparent_68%)]'}`}
          ></div>
          <div
            className={`cover-purple-aura absolute inset-[30px] rounded-full pointer-events-none mix-blend-screen ${theme === 'light' ? 'bg-[radial-gradient(circle,rgba(123,109,255,0.13)_0%,rgba(123,109,255,0.06)_42%,transparent_70%)]' : 'bg-[radial-gradient(circle,rgba(123,109,255,0.16)_0%,rgba(123,109,255,0.08)_40%,rgba(0,200,232,0.025)_58%,transparent_74%)]'}`}
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
                  className={`absolute rounded-full animate-[orbit-grain-twinkle_5.8s_ease-in-out_infinite] ${theme === 'light' ? 'bg-cyan-100 shadow-[0_0_2px_rgba(103,232,249,0.08)]' : 'bg-cyan-100 shadow-[0_0_3px_rgba(103,232,249,0.08)]'}`}
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
                  className={`absolute rounded-full animate-[static-grain-twinkle_7.2s_ease-in-out_infinite] ${theme === 'light' ? 'bg-[#b81fff] shadow-[0_0_4px_rgba(184,31,255,0.24)]' : 'bg-[var(--color-cover-orbit-violet)] shadow-[0_0_5px_rgba(123,109,255,0.22)]'}`}
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
                        ? 0.72
                        : i % 2 === 0
                          ? 0.5
                          : 0.34,
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
                className={`absolute top-0 left-1/2 w-[1px] h-2.5 origin-bottom transform -translate-x-1/2 ${theme === 'light' ? 'bg-cyan-200/22' : 'bg-cyan-300/12'}`}
                style={{ transform: `rotate(${i * 22.5}deg) translateY(0)` }}
              ></div>
            ))}
          </div>
          {/* Layer 4 — sweep orbit */}
          <div className="cover-orbit-sweep absolute inset-[18px] rounded-full overflow-hidden opacity-22 pointer-events-none">
            <div
              className={`absolute top-1/2 left-1/2 w-1/2 h-[1.5px] origin-left animate-[radar-spin_9s_linear_infinite] ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-cyan-200/18 to-cyan-300' : 'bg-gradient-to-r from-transparent via-cyan-300/16 to-cyan-200'}`}
            ></div>
          </div>
          <div
            className={`cover-orbit-tail absolute inset-[34px] rounded-full pointer-events-none ${theme === 'light' ? 'bg-[conic-gradient(from_18deg,transparent_0deg,transparent_250deg,rgba(34,211,238,0.09)_286deg,rgba(123,109,255,0.16)_318deg,transparent_352deg)]' : 'bg-[conic-gradient(from_18deg,transparent_0deg,transparent_250deg,rgba(0,200,232,0.11)_286deg,rgba(123,109,255,0.20)_318deg,transparent_352deg)]'}`}
          ></div>
          {/* Layer 4.5 — industrial hairline calibration */}
          <div className="absolute inset-[24px] rounded-full pointer-events-none opacity-70">
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={`hairline-${i}`}
                className={`absolute left-1/2 top-0 w-px origin-[50%_136px] md:origin-[50%_160px] ${i % 6 === 0 ? 'h-3' : i % 3 === 0 ? 'h-2' : 'h-1'} ${theme === 'light' ? 'bg-slate-700/18' : 'bg-cyan-100/14'}`}
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
                className={`absolute font-mono text-[7px] tracking-[0.24em] ${theme === 'light' ? 'text-blue-600/32' : 'text-cyan-100/22'}`}
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
            className={`cover-orbit-primary absolute z-20 inset-[40px] border-[2.5px] rounded-full animate-[spin-z_18s_linear_infinite] transition-all duration-500 pointer-events-none ${theme === 'light' ? (showCustomPrinciples ? 'border-t-cyan-400 border-l-cyan-300/88 border-r-cyan-300/88 border-b-cyan-400 shadow-[0_0_52px_rgba(34,211,238,0.42),0_110px_55px_-44px_rgba(34,211,238,0.15)]' : 'border-t-cyan-400 border-l-cyan-300/62 border-r-cyan-300/62 border-b-cyan-400 shadow-[0_0_42px_rgba(34,211,238,0.32),0_96px_48px_-40px_rgba(34,211,238,0.12)]') : showCustomPrinciples ? 'border-t-cyan-100 border-l-cyan-100/72 border-r-cyan-100/72 border-b-cyan-100 shadow-[0_0_40px_rgba(0,200,232,0.42),0_0_24px_rgba(0,200,232,0.22)]' : 'border-t-cyan-100 border-l-cyan-100/55 border-r-cyan-100/55 border-b-cyan-100 shadow-[0_0_32px_rgba(0,200,232,0.34),0_0_18px_rgba(0,200,232,0.16)]'}`}
          >
            <div
              className={`absolute top-0 left-1/2 w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ${theme === 'light' ? 'bg-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.52)]' : 'bg-cyan-50 shadow-[0_0_26px_rgba(0,200,232,0.55)]'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full border-[3px] border-transparent ${theme === 'light' ? 'border-t-slate-900/16 border-r-slate-900/12' : 'border-t-black/42 border-r-black/32'} opacity-80`}
            ></div>
            <div
              className={`absolute inset-[-1px] rounded-full border-[3px] border-transparent ${theme === 'light' ? 'border-b-cyan-100/90 border-l-cyan-100/82 shadow-[0_0_14px_rgba(34,211,238,0.28)]' : 'border-b-cyan-50/92 border-l-cyan-50/82 shadow-[0_0_16px_rgba(34,211,238,0.30)]'}`}
            ></div>
          </div>
          <div
            className={`cover-orbit-secondary cover-orbit-spin-x absolute z-30 inset-[60px] border-[3px] rounded-full animate-[spin-x_16s_linear_infinite] [transform-style:preserve-3d] transition-all duration-500 pointer-events-none ${theme === 'light' ? (showCustomPrinciples ? 'border-[#7a1cff]/34 shadow-[0_0_14px_rgba(122,28,255,0.09)]' : 'border-[#7a1cff]/24 shadow-[0_0_12px_rgba(122,28,255,0.06)]') : showCustomPrinciples ? 'border-cyan-400/28 shadow-[0_0_14px_rgba(0,200,232,0.14)]' : 'border-cyan-400/18 shadow-[0_0_10px_rgba(0,200,232,0.08)]'}`}
          >
            <div
              className={`absolute inset-0 border-t-[2px] rounded-full blur-0 transition-all duration-500 ${theme === 'light' ? (showCustomPrinciples ? 'border-t-[#b81fff]/72 shadow-[0_0_6px_rgba(184,31,255,0.12)]' : 'border-t-[#b81fff]/54 shadow-[0_0_4px_rgba(184,31,255,0.08)]') : showCustomPrinciples ? 'border-t-cyan-300/55 shadow-[0_0_8px_rgba(0,200,232,0.12)]' : 'border-t-cyan-300/38 shadow-[0_0_5px_rgba(0,200,232,0.07)]'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full border-[4px] border-transparent ${theme === 'light' ? 'border-l-slate-900/14 border-b-slate-900/10' : 'border-l-black/36 border-b-black/24'} opacity-75`}
            ></div>
            <div
              className={`absolute inset-[-0.5px] rounded-full border-[2px] border-transparent ${theme === 'light' ? 'border-t-[#d14cff]/66 border-r-[#d14cff]/54 shadow-[0_0_5px_rgba(209,76,255,0.09)]' : 'border-t-cyan-200/42 border-r-cyan-200/32 shadow-[0_0_6px_rgba(0,200,232,0.08)]'}`}
            ></div>
          </div>
          {/* spin-y 内环：色系对齐「观测系统连接」标签（浅 blue-600 / 深 cyan-300） */}
          <div
            className={`cover-orbit-secondary cover-orbit-spin-y absolute z-10 inset-[80px] border-[1.5px] rounded-full animate-[spin-y_24s_linear_infinite] [transform-style:preserve-3d] transition-all duration-500 pointer-events-none ${theme === 'light' ? (showCustomPrinciples ? 'border-blue-600/30 shadow-[0_0_12px_rgba(37,99,235,0.09)]' : 'border-blue-600/20 shadow-[0_0_8px_rgba(37,99,235,0.06)]') : showCustomPrinciples ? 'border-cyan-300/28 shadow-[0_0_14px_rgba(103,232,249,0.10)]' : 'border-cyan-300/18 shadow-[0_0_10px_rgba(103,232,249,0.07)]'}`}
          >
            <div
              className={`absolute inset-0 border-l-[3px] rounded-full transition-all duration-500 ${theme === 'light' ? (showCustomPrinciples ? 'border-l-blue-500/54 shadow-[0_0_10px_rgba(59,130,246,0.12)]' : 'border-l-blue-500/40') : showCustomPrinciples ? 'border-l-cyan-300/50 shadow-[0_0_14px_rgba(103,232,249,0.14)]' : 'border-l-cyan-300/36 shadow-[0_0_10px_rgba(103,232,249,0.10)]'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full border-[3px] border-transparent ${theme === 'light' ? 'border-t-slate-900/18 border-l-slate-900/14' : 'border-t-black/40 border-l-black/30'} opacity-78`}
            ></div>
            <div
              className={`absolute inset-[-1px] rounded-full border-[3px] border-transparent ${theme === 'light' ? 'border-b-blue-400/68 border-r-blue-400/54 shadow-[0_0_8px_rgba(96,165,250,0.14)]' : 'border-b-cyan-200/64 border-r-cyan-200/50 shadow-[0_0_12px_rgba(165,243,252,0.16)]'}`}
            ></div>
          </div>
          {/* Layer 7 — inner temporal orbit（深色仅用 #7B6DFF 轨迹，不用玫红） */}
          <div
            className={`cover-orbit-inner absolute inset-[100px] md:inset-[126px] rounded-full animate-[spin-diagonal_28s_linear_infinite] [transform-style:preserve-3d] transition-all duration-500 pointer-events-none ${theme === 'light' ? (showCustomPrinciples ? 'shadow-[0_0_14px_rgba(255,46,204,0.09)]' : 'shadow-[0_0_9px_rgba(255,46,204,0.05)]') : showCustomPrinciples ? 'shadow-[0_0_16px_rgba(123,109,255,0.2)]' : 'shadow-[0_0_12px_rgba(123,109,255,0.12)]'}`}
            style={{
              background:
                theme === 'light'
                  ? showCustomPrinciples
                    ? 'conic-gradient(from 150deg, rgba(255, 46, 204, 0.24), rgba(255, 92, 220, 0.62), rgba(214, 38, 172, 0.36), rgba(250, 72, 208, 0.54), rgba(255, 46, 204, 0.24))'
                    : 'conic-gradient(from 150deg, rgba(255, 46, 204, 0.10), rgba(255, 80, 214, 0.34), rgba(220, 42, 175, 0.20), rgba(245, 68, 205, 0.28), rgba(255, 46, 204, 0.10))'
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
              className={`absolute inset-0 rounded-full border-r-[2px] border-transparent transition-all duration-500 ${theme === 'light' ? (showCustomPrinciples ? 'border-r-[#ff2ecc]/64' : 'border-r-[#ff2ecc]/44') : showCustomPrinciples ? 'border-r-[rgba(123,109,255,0.72)]' : 'border-r-[rgba(123,109,255,0.48)]'}`}
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
              className={`absolute inset-[-12px] rounded-full border transition-all duration-500 ${showCustomPrinciples ? (theme === 'light' ? 'border-vector-cyan-brand/28 animate-[mode-pulse_3.1s_ease-in-out_infinite]' : 'border-cyan-300/22 animate-[mode-pulse_3.1s_ease-in-out_infinite]') : 'border-transparent'}`}
            ></div>
            <div
              className={`absolute inset-0 rounded-full blur-md motion-reduce:animate-none ${theme === 'light' ? 'animate-[cover-outer-glow_5s_ease-in-out_infinite] bg-white' : 'animate-[cover-outer-glow_5s_ease-in-out_infinite] bg-[#5eeaf2]/08'}`}
            ></div>
            <div
              className={`absolute inset-[-4px] rounded-full blur-lg motion-reduce:animate-none ${theme === 'light' ? 'animate-[cover-outer-glow_4.2s_ease-in-out_infinite] bg-cyan-400/18' : 'animate-[cover-outer-glow_4.2s_ease-in-out_infinite] bg-[#00c8e8]/14'}`}
            ></div>
            <div
              className={`absolute inset-0 border-2 rounded-full flex items-center justify-center transition-all duration-300 ${theme === 'light' ? (showCustomPrinciples ? 'border-vector-cyan-brand bg-cyan-50 shadow-[0_0_18px_rgba(20,184,230,0.28)]' : 'border-vector-cyan-brand bg-white') : showCustomPrinciples ? 'border-cyan-300 bg-cyan-950/90 shadow-[0_0_24px_rgba(34,211,238,0.35)]' : 'border-white bg-black/50'}`}
            >
              <span
                className={`cover-core-scan pointer-events-none absolute inset-[7px] rounded-full ${theme === 'light' ? 'bg-[linear-gradient(180deg,transparent_0%,rgba(34,211,238,0.14)_48%,transparent_54%)]' : 'bg-[linear-gradient(180deg,transparent_0%,rgba(123,109,255,0.16)_47%,rgba(94,234,242,0.12)_50%,transparent_55%)]'}`}
              ></span>
              <Cpu
                className={`motion-reduce:animate-none w-8 h-8 animate-[cover-icon-breathe_4s_ease-in-out_infinite] ${theme === 'light' ? 'text-vector-cyan-brand' : showCustomPrinciples ? 'text-[color:var(--color-cover-status-title)]' : 'text-[color:var(--color-cover-cta-icon)]'}`}
              />
            </div>
          </button>
          <div className="absolute left-[calc(100%+2.75rem)] top-2 hidden md:flex flex-col items-start gap-2 min-w-[180px]">
            <div
              className={`flex items-center gap-2 text-xs font-mono pl-3 ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-[color:var(--color-cover-status-title)]'}`}
            >
              <Cpu
                className={`w-4 h-4 motion-reduce:animate-none animate-[cover-icon-breathe_5s_ease-in-out_infinite] ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-[color:var(--color-cover-status-title)]'}`}
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
                className={`ml-6 max-w-[180px] text-[9px] font-mono uppercase tracking-[0.22em] leading-relaxed transition-all duration-300 ${theme === 'light' ? 'text-vector-cyan-brand/80' : 'text-[color:var(--color-cover-status-body)]'} ${showCustomPrinciples ? 'opacity-100 translate-x-0' : 'opacity-60 translate-x-0'}`}
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
                className={`ml-6 max-w-[180px] text-[9px] font-mono uppercase tracking-[0.22em] leading-relaxed transition-all duration-300 ${theme === 'light' ? 'text-vector-cyan-brand/80' : 'text-[color:var(--color-cover-status-body)]'} ${showCustomPrinciples ? 'opacity-100' : 'opacity-60'}`}
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
          <div className="absolute right-[calc(100%+2.5rem)] bottom-2 hidden md:flex flex-col items-end gap-1">
            <div
              className={`flex items-center gap-1 text-[9px] font-mono border-r-2 pr-2 pl-1 py-0.5 ${theme === 'light' ? 'text-blue-600 border-blue-500 bg-white/60 backdrop-blur-[2px]' : 'text-[color:var(--color-cover-status-title)] border-[color:var(--color-cover-status-rule)] bg-[color-mix(in_srgb,var(--color-space-bg)_55%,transparent)] shadow-[0_0_10px_rgba(0,200,232,0.12)]'}`}
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
              stroke={
                theme === 'light'
                  ? 'var(--color-vector-cyan-brand)'
                  : 'var(--color-vector-cyan-pure)'
              }
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <line
              x1="160"
              y1="160"
              x2="40"
              y2="240"
              stroke={theme === 'light' ? 'var(--color-vector-blue-deep)' : '#7b6dff'}
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <circle
              cx="280"
              cy="80"
              r="2"
              fill={
                theme === 'light'
                  ? 'var(--color-vector-cyan-brand)'
                  : 'var(--color-vector-cyan-pure)'
              }
            />
            <circle
              cx="40"
              cy="240"
              r="2"
              fill={theme === 'light' ? 'var(--color-vector-blue-deep)' : '#7b6dff'}
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
          className={`cover-enter cover-enter--1 relative z-10 text-5xl sm:text-7xl md:text-9xl font-bold tracking-[0.08em] md:tracking-[0.12em] mb-2 max-md:mix-blend-normal md:mix-blend-plus-lighter [transform:scaleX(1.045)] ${theme === 'light' ? 'text-vector-ink-strong' : 'text-[color:var(--color-cover-hero-title)] md:drop-shadow-[0_2px_0_rgba(123,109,255,0.22)] md:[text-shadow:0_0_20px_rgba(0,200,232,0.10),0_0_34px_rgba(123,109,255,0.12),0_8px_26px_rgba(0,0,0,0.34)]'}`}
          data-text="VECTOR"
        >
          VECTOR
        </h1>
        <div
          className={`cover-enter cover-enter--2 relative z-10 flex items-center gap-4 font-bold text-xl md:text-3xl tracking-[0.5em] md:tracking-[0.54em] uppercase mb-4 ${theme === 'light' ? 'text-vector-cyan-brand' : ''}`}
        >
          <span
            className={`h-[1px] w-24 md:w-36 ${theme === 'light' ? 'bg-gradient-to-l from-vector-cyan-brand/60 via-[#7b6dff]/32 to-transparent' : 'bg-gradient-to-l from-[color:var(--color-cover-hero-rule)] via-[#7b6dff]/55 to-transparent shadow-[0_0_12px_rgba(0,200,232,0.26),0_0_18px_rgba(123,109,255,0.20)]'}`}
          ></span>
          <span
            className={`${theme === 'light' ? 'text-vector-ink-strong' : 'text-[color:var(--color-cover-hero-subtitle)]'}`}
          >
            {t.vectorLife}
          </span>
          <span
            className={`h-[1px] w-24 md:w-36 ${theme === 'light' ? 'bg-gradient-to-r from-vector-cyan-brand/60 via-[#7b6dff]/32 to-transparent' : 'bg-gradient-to-r from-[color:var(--color-cover-hero-rule)] via-[#7b6dff]/55 to-transparent shadow-[0_0_12px_rgba(0,200,232,0.26),0_0_18px_rgba(123,109,255,0.20)]'}`}
          ></span>
        </div>
        <p
          className={`cover-enter cover-enter--2b relative z-10 mx-auto mb-3 flex max-w-[min(90vw,720px)] items-center justify-center px-4 text-center text-sm font-semibold leading-relaxed tracking-[0.12em] md:text-lg md:tracking-[0.18em] ${theme === 'light' ? 'text-vector-ink-strong/88' : 'text-[color:var(--color-cover-status-body)]'}`}
          aria-label={t.brandNarrative}
        >
          <span
            className={`${theme === 'light' ? 'text-vector-cyan-brand/90' : 'text-cyan-100/78 drop-shadow-[0_0_10px_rgba(0,200,232,0.18)]'}`}
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
              ? 'rounded-full border border-vector-cyan-brand/28 bg-white/62 backdrop-blur-md text-vector-cyan-brand shadow-[0_18px_60px_rgba(20,184,230,0.15)] hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[inset_0_0_0_1px_rgba(0,122,140,0.12),0_20px_64px_rgba(20,184,230,0.18)] focus:ring-vector-cyan-brand/55 focus:ring-offset-white'
              : 'rounded-full border border-[color:var(--color-cover-cta-border)]/46 bg-[rgba(5,13,24,0.46)] backdrop-blur-xl hover:-translate-y-0.5 shadow-[inset_0_1px_0_0_rgba(157,246,250,0.08),inset_0_-12px_28px_rgba(123,109,255,0.055),0_12px_32px_rgba(0,0,0,0.34),0_0_14px_rgba(0,200,232,0.10),0_0_18px_rgba(123,109,255,0.08)] hover:shadow-[inset_0_1px_0_0_rgba(157,246,250,0.12),inset_0_-12px_28px_rgba(123,109,255,0.075),0_0_20px_rgba(0,200,232,0.24),0_0_16px_rgba(123,109,255,0.22)] focus:ring-[color:var(--color-cover-cta-hover-glow)]/45 focus:ring-offset-[var(--color-space-bg)]'
          }`}
        >
          <span
            className={`pointer-events-none absolute inset-0 rounded-full ${theme === 'light' ? 'opacity-60 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.16),transparent_70%)]' : 'opacity-80 bg-[radial-gradient(ellipse_at_center,rgba(123,109,255,0.10)_0%,rgba(0,200,232,0.055)_38%,transparent_72%)]'}`}
          ></span>
          <span
            className={`cover-tunnel-lines pointer-events-none absolute inset-x-7 inset-y-2 rounded-full border-y ${theme === 'light' ? 'border-vector-cyan-brand/14' : 'border-cyan-200/14'}`}
          ></span>
          <span
            className={`cover-tunnel-depth cover-tunnel-depth--upper pointer-events-none absolute left-[24%] right-[13%] top-[38%] h-px ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-vector-cyan-brand/18 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-100/16 to-[#7b6dff]/14'}`}
          ></span>
          <span
            className={`cover-tunnel-depth cover-tunnel-depth--lower pointer-events-none absolute left-[26%] right-[17%] top-[63%] h-px ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-vector-cyan-brand/12 to-transparent' : 'bg-gradient-to-r from-transparent via-[#7b6dff]/16 to-cyan-100/10'}`}
          ></span>
          <span
            className={`cover-tunnel-vanish pointer-events-none absolute left-[23%] right-[8%] top-1/2 h-px -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-r from-vector-cyan-brand/14 via-vector-cyan-brand/34 to-transparent' : 'bg-gradient-to-r from-cyan-200/10 via-[#7b6dff]/42 to-transparent'}`}
          ></span>
          <span
            className={`cover-tunnel-ticks pointer-events-none absolute left-[34%] right-[16%] top-1/2 h-5 -translate-y-1/2 opacity-70 ${theme === 'light' ? 'text-vector-cyan-brand/24' : 'text-cyan-100/20'}`}
            aria-hidden
          >
            {Array.from({ length: 9 }).map((_, tickIndex) => (
              <span
                key={`launch-tick-${tickIndex}`}
                className={`absolute top-1/2 w-px -translate-y-1/2 ${tickIndex % 3 === 0 ? 'h-3' : 'h-2'} ${theme === 'light' ? 'bg-vector-cyan-brand/22' : 'bg-cyan-100/18'}`}
                style={{ left: `${tickIndex * 12.5}%` }}
              />
            ))}
          </span>
          <span
            className={`cover-tunnel-gate cover-tunnel-gate--left pointer-events-none absolute left-4 top-1/2 h-10 w-px -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-b from-transparent via-vector-cyan-brand/34 to-transparent' : 'bg-gradient-to-b from-transparent via-cyan-200/42 to-transparent'}`}
          ></span>
          <span
            className={`cover-tunnel-gate cover-tunnel-gate--right pointer-events-none absolute right-4 top-1/2 h-10 w-px -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-b from-transparent via-[#7b6dff]/26 to-transparent' : 'bg-gradient-to-b from-transparent via-[#7b6dff]/44 to-transparent'}`}
          ></span>
          <span
            className={`cover-launch-stream pointer-events-none absolute left-14 right-12 top-1/2 h-px -translate-y-1/2 scale-x-0 ${theme === 'light' ? 'bg-gradient-to-r from-vector-cyan-brand/10 via-vector-cyan-brand/50 to-transparent' : 'bg-gradient-to-r from-cyan-200/12 via-[#7b6dff]/72 to-transparent'}`}
          ></span>
          <span
            className={`cover-tunnel-aperture pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-10 -translate-x-1/2 -translate-y-1/2 scale-x-0 rounded-full ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-vector-cyan-brand/70 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-100/80 to-[#7b6dff]/38'}`}
          ></span>
          <span
            className={`cover-tunnel-wake pointer-events-none absolute left-10 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full opacity-0 blur-md ${theme === 'light' ? 'bg-vector-cyan-brand/18' : 'bg-[#7b6dff]/16'}`}
          ></span>
          <span
            className={`pointer-events-none absolute -inset-px rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${theme === 'light' ? 'blur-md bg-cyan-200/32' : 'shadow-[0_0_18px_rgba(0,200,232,0.24),0_0_10px_rgba(123,109,255,0.18)]'}`}
          ></span>
          <span
            className={`pointer-events-none absolute left-5 top-1/2 h-px w-16 -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-r from-vector-cyan-brand/55 to-transparent' : 'bg-gradient-to-r from-[color:var(--color-cover-status-rule)] to-transparent'}`}
          ></span>
          <span
            className={`pointer-events-none absolute right-5 top-1/2 h-px w-16 -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-l from-vector-cyan-brand/45 to-transparent' : 'bg-gradient-to-l from-[#7b6dff]/70 to-transparent'}`}
          ></span>
          <span className="relative flex items-center gap-4">
            <span
              className={`cover-launch-thumb relative flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full ${theme === 'light' ? 'shadow-[inset_0_0_0_1px_rgba(20,184,230,0.32),0_0_0_1px_rgba(0,122,140,0.06),0_8px_28px_rgba(20,184,230,0.1)]' : 'shadow-[inset_0_0_0_1px_rgba(44,203,218,0.35),0_0_16px_rgba(0,200,232,0.15),0_4px_16px_rgba(0,0,0,0.35)]'}`}
              aria-hidden
            >
              <span
                className={`pointer-events-none absolute inset-px rounded-full ${theme === 'light' ? 'bg-[conic-gradient(from_210deg,var(--color-vector-cyan-brand)_0%,transparent_32%,transparent_68%,var(--color-vector-cyan-brand)_100%)] opacity-[0.12]' : 'bg-[conic-gradient(from_200deg,rgba(94,234,242,0.35)_0%,transparent_38%,transparent_62%,rgba(0,200,232,0.28)_100%)] opacity-[0.2]'}`}
              />
              <span
                className={`pointer-events-none absolute inset-[6px] md:inset-[7px] rounded-full ${theme === 'light' ? 'bg-white/82' : 'bg-[linear-gradient(165deg,rgba(8,22,38,0.92)_0%,rgba(5,13,24,0.88)_100%)]'}`}
              />
              <span
                className={`pointer-events-none absolute inset-[6px] md:inset-[7px] rounded-full border ${theme === 'light' ? 'border-vector-cyan-brand/18' : 'border-[color:var(--color-cover-cta-border)]/35'}`}
              />
              <GeometricBoat
                variant="hero"
                theme={theme}
                className={`relative z-[1] h-6 w-6 md:h-7 md:w-7 animate-[cover-boat-float_2.8s_ease-in-out_infinite] motion-reduce:animate-none ${theme === 'light' ? 'text-[color-mix(in_srgb,var(--color-vector-cyan-brand)_92%,#0a3d47)] drop-shadow-[0_0_10px_rgba(20,184,230,0.28)]' : 'text-[color:var(--color-cover-cta-icon)] drop-shadow-[0_0_10px_rgba(0,200,232,0.25)]'}`}
              />
            </span>
            <span
              className={`cover-launch-label relative flex min-w-[156px] items-center justify-center text-[12px] md:text-sm font-mono uppercase tracking-[0.28em] md:tracking-[0.34em] ${theme === 'light' ? 'text-vector-cyan-brand/95' : 'text-[color:var(--color-cover-cta-label)]'}`}
            >
              <span
                className={`cover-label-pulse pointer-events-none absolute left-1/2 top-1/2 h-px w-20 -translate-x-1/2 -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-vector-cyan-brand/24 to-transparent' : 'bg-gradient-to-r from-transparent via-[#7b6dff]/28 to-transparent'}`}
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
            `}</style>
    </div>
  );
};

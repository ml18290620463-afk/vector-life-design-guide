import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Cpu, Sparkles } from 'lucide-react';
import { Language, Principle } from '../types';
import { PRESET_PRINCIPLES, TRANSLATIONS } from '../constants';
import { NOISE_BG_STYLE } from '../lib/noiseTexture';
import { CyberButton } from './CyberButton';
import { DecryptionText } from './DecryptionText';
import { useTimeoutManager } from '../hooks/useTimeoutManager';
import { createSeededRandom } from '../lib/random';

interface MemoryFragmentsProps {
  onComplete: () => void;
  language: Language;
  principles: Principle[];
}

interface FragmentStyle {
  id: number;
  year: number;
  text: string;
  top: number;
  left: number;
  zIndex: number;
  rotation: number;
  status: 'waiting' | 'active' | 'exiting';
}

type PrincipleSource = Partial<Principle> & {
  source?: string;
  text: string;
  year?: number;
  date?: string;
};

// Internal Typewriter Component
const Typewriter = ({ text, isActive }: { text: string; isActive: boolean }) => {
  const [displayLength, setDisplayLength] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setDisplayLength(0);
      return;
    }

    // Tiny initial delay to sync with fade-in
    let interval: ReturnType<typeof setInterval> | undefined;
    const startTimeout = setTimeout(() => {
      let current = 0;
      interval = setInterval(() => {
        current++;
        setDisplayLength(current);
        if (current >= text.length) clearInterval(interval);
      }, 30); // Faster typing speed (30ms)
    }, 100);

    return () => {
      clearTimeout(startTimeout);
      if (interval) clearInterval(interval);
    };
  }, [isActive, text]);

  return (
    <span className="inline-block relative">
      {text.slice(0, displayLength)}
      {isActive && displayLength < text.length && (
        <span className="inline-block w-2 h-4 bg-cyan-400/50 animate-pulse ml-1 align-middle"></span>
      )}
    </span>
  );
};

export const MemoryFragments: React.FC<MemoryFragmentsProps> = ({
  onComplete,
  language,
  principles,
}) => {
  const t = TRANSLATIONS[language];
  const [fragments, setFragments] = useState<FragmentStyle[]>([]);
  const [currentYear, setCurrentYear] = useState(2023);
  const [showButton, setShowButton] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);
  const skippedRef = useRef(false);
  const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutManager();

  // Configuration
  const INTERVAL_PER_ITEM = 800; // Faster appearance
  const STAR_LIFETIME = 8000; // How long a star stays before fading

  const sourcePrinciples = useMemo<PrincipleSource[]>(
    () =>
      principles.length >= 5
        ? principles
        : [...principles, ...(PRESET_PRINCIPLES[language] || PRESET_PRINCIPLES.en)],
    [language, principles],
  );

  const initialFragments = useMemo(() => {
    // 1. Calculate positions with Collision Detection
    const occupied: { x: number; y: number; r: number }[] = [];

    return sourcePrinciples.map((principle, index) => {
      const random = createSeededRandom(`${language}-${principle.id || principle.text}-${index}`);
      let bestPos = { top: 50, left: 50 };
      let maxDist = -999;

      // Estimated "radius" of a text block in % of screen
      const itemRadius = 8; // Slightly reduced radius to pack more stars

      // Attempt insertion - Rejection Sampling
      for (let attempt = 0; attempt < 50; attempt++) {
        // Random angle
        const angle = random() * Math.PI * 2;
        // Random distance from center (keep clear of the year indicator in middle)
        // Range: 15% to 48% radius from center (Expanded range)
        const dist = 20 + random() * 28;

        const left = 50 + dist * Math.cos(angle);
        const top = 50 + dist * Math.sin(angle) * 0.8; // Flatten Y slightly for screen aspect

        // Calculate distance to nearest existing item
        let minDist = 1000;
        for (const p of occupied) {
          const d = Math.sqrt(Math.pow(p.x - left, 2) + Math.pow(p.y - top, 2));
          const gap = d - (p.r + itemRadius);
          if (gap < minDist) minDist = gap;
        }

        if (occupied.length === 0) minDist = 100;

        if (minDist > maxDist) {
          maxDist = minDist;
          bestPos = { top, left };
        }

        if (minDist > 1) break; // Acceptable gap
      }

      occupied.push({ x: bestPos.left, y: bestPos.top, r: itemRadius });

      return {
        id: index,
        year: principle.year || 2025,
        text: `【${principle.source || principle.date || principle.year}】${principle.text}`,
        top: Math.max(10, Math.min(90, bestPos.top)),
        left: Math.max(5, Math.min(95, bestPos.left)),
        zIndex: index,
        status: 'waiting' as const,
        rotation: (random() - 0.5) * 6,
      };
    });
  }, [language, sourcePrinciples]);

  useEffect(() => {
    clearScheduledTimeouts();
    skippedRef.current = false;
    setIsSkipped(false);
    setShowButton(false);
    setCurrentYear(2023);
    setFragments(initialFragments);

    // 2. Start Star Sequence
    let activeIndex = 0;

    const timer = setInterval(() => {
      if (skippedRef.current) return;

      if (activeIndex >= initialFragments.length) {
        clearInterval(timer);
        scheduleTimeout(() => setShowButton(true), 2000);
        return;
      }

      const currentIndex = activeIndex;
      const currentItem = initialFragments[currentIndex];

      // Activate the star
      setFragments((prev) => {
        const next = [...prev];
        if (next[currentIndex]) {
          next[currentIndex] = { ...next[currentIndex], status: 'active' };
        }
        return next;
      });

      // Update Year Display
      if (currentItem) {
        setCurrentYear((prevYear) => (currentItem.year !== prevYear ? currentItem.year : prevYear));
      }

      // Schedule Fade Out (Disappear slowly)
      scheduleTimeout(() => {
        setFragments((prev) => {
          const next = [...prev];
          // Only fade out if it is still active (hasn't been skipped/forced)
          if (next[currentIndex] && next[currentIndex].status === 'active') {
            next[currentIndex] = { ...next[currentIndex], status: 'exiting' };
          }
          return next;
        });
      }, STAR_LIFETIME);

      activeIndex++;
    }, INTERVAL_PER_ITEM);

    return () => {
      clearInterval(timer);
      clearScheduledTimeouts();
    };
  }, [clearScheduledTimeouts, initialFragments, scheduleTimeout]);

  const handleSkip = () => {
    skippedRef.current = true;
    clearScheduledTimeouts();
    setIsSkipped(true);
    // Reveal all remaining stars immediately
    setFragments((prev) => prev.map((f) => ({ ...f, status: 'active' })));
    setCurrentYear(2025);
    setShowButton(true);
  };

  const getYearStyle = (year: number) => {
    switch (year) {
      case 2023:
        return 'text-cyan-200';
      case 2024:
        return 'text-blue-200';
      case 2025:
        return 'text-indigo-200';
      default:
        return 'text-gray-200';
    }
  };

  const getYearGlow = (year: number) => {
    switch (year) {
      case 2023:
        return 'text-cyan-950/30';
      case 2024:
        return 'text-blue-950/30';
      case 2025:
        return 'text-indigo-950/30';
      default:
        return 'text-gray-900';
    }
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center perspective-[1000px]">
      {/* Background Tunnel */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200vw] h-[200vw] bg-[radial-gradient(circle,transparent_10%,black_85%)] z-10"></div>
        {/* Phase 4.5 §D — inline noise SVG (see lib/noiseTexture.ts). */}
        <div className="absolute inset-0 opacity-10 z-0" style={NOISE_BG_STYLE}></div>
        <div className="absolute inset-0 bg-[linear-gradient(color-mix(in_srgb,_white_2%,_transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,_white_2%,_transparent)_1px,transparent_1px)] bg-[size:150px_150px] [transform:perspective(500px)_rotateX(60deg)_scale(3)] animate-[tunnel_40s_linear_infinite] opacity-20"></div>
      </div>

      {/* Central Year */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 font-black text-[20vw] leading-none transition-all duration-1000 select-none blur-[2px] ${getYearGlow(currentYear)}`}
      >
        {currentYear}
      </div>

      {/* Fragments */}
      <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">
        {fragments.map((frag) => {
          const isVisible = frag.status !== 'waiting';
          const isExiting = frag.status === 'exiting';

          return (
            <div
              key={frag.id}
              className={`
                absolute w-[min(90vw,300px)] flex flex-col items-center
                transition-all duration-1000 ease-out
                ${isVisible ? (isExiting ? 'opacity-0 blur-sm scale-95 duration-[3000ms]' : 'opacity-100 scale-100') : 'opacity-0 scale-90'}
              `}
              style={{
                top: `${frag.top}%`,
                left: `${frag.left}%`,
                transform: `translate(-50%, -50%) rotate(${frag.rotation}deg)`,
              }}
            >
              {/* Twinkling Container */}
              <div className={!isExiting && isVisible ? 'animate-twinkle' : ''}>
                <div className="flex flex-col items-center gap-2">
                  {/* Tiny Star Icon Decor */}
                  <Sparkles
                    className={`w-3 h-3 opacity-50 ${getYearStyle(frag.year).split(' ')[0]} ${isVisible ? 'animate-pulse' : ''}`}
                  />

                  {/* Text with Typewriter Effect */}
                  <p
                    className={`
                     text-lg md:text-xl font-light font-sans tracking-wide leading-relaxed text-center whitespace-pre-wrap
                     ${getYearStyle(frag.year)}
                   `}
                  >
                    <Typewriter text={frag.text} isActive={isVisible} />
                  </p>
                </div>
              </div>

              {/* Metadata - fades out with parent */}
              <div
                className={`mt-2 flex gap-3 text-[9px] font-mono tracking-[0.3em] uppercase transition-opacity duration-1000 delay-500 ${isVisible ? 'opacity-40' : 'opacity-0'} ${isExiting ? '!opacity-0' : ''} text-gray-500`}
              >
                <span>{frag.year}</span>
                <span>{'//'}</span>
                <span>{(frag.id ?? 0).toString().padStart(2, '0')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div
        className={`relative z-50 transition-all duration-1000 flex flex-col items-center gap-6 mt-40 ${showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
      >
        {!showButton && !isSkipped && (
          <button
            onClick={handleSkip}
            className="fixed bottom-10 right-10 text-xs font-mono text-gray-700 hover:text-white transition-all pointer-events-auto tracking-widest z-[100]"
          >
            {t.skipSequence}
          </button>
        )}

        {showButton && (
          <div className="animate-in fade-in zoom-in duration-1000 flex flex-col items-center">
            <div className="flex items-center gap-2 text-cyan-400/80 font-mono text-xs mb-6 tracking-[0.2em] animate-pulse">
              <Cpu className="w-4 h-4" />
              <DecryptionText text={t.consciousnessSynced} speed={40} />
            </div>

            <CyberButton
              onClick={onComplete}
              className="pointer-events-auto min-w-[260px] h-16 bg-transparent !border-cyan-500/50 text-2xl text-cyan-100 font-light tracking-widest hover:bg-cyan-900/10 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-500 backdrop-blur-sm"
            >
              <span className="flex items-center gap-4">
                {t.enterNow} <ArrowRight className="w-6 h-6" />
              </span>
            </CyberButton>
          </div>
        )}
      </div>

      <style>{`
        @keyframes tunnel {
          0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
          100% { transform: perspective(500px) rotateX(60deg) translateY(50px); }
        }
        @keyframes twinkle {
          0%, 100% { filter: brightness(1); transform: scale(1); }
          50% { filter: brightness(1.3); transform: scale(1.02); }
        }
        .animate-twinkle {
          animation: twinkle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

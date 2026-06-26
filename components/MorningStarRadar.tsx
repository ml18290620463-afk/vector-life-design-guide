import React from 'react';
import { motion } from 'motion/react';
import { Brain, FastForward, Heart, Shield, User } from 'lucide-react';
import { Theme } from '../types';
import { TranslationDictionary } from '../i18n/translations';

interface MorningStarRadarProps {
  metrics: Record<string, number>;
  t: TranslationDictionary;
  theme: Theme;
}

export const MorningStarRadar: React.FC<MorningStarRadarProps> = ({ metrics, t, theme }) => {
  const dimensions = [
    {
      key: 'rationality',
      label: t.rationality,
      icon: Brain,
      color: theme === 'light' ? 'var(--color-vector-cyan-brand)' : 'var(--color-vector-cyan-pure)',
    },
    {
      key: 'emotionality',
      label: t.emotionality,
      icon: Heart,
      color: theme === 'light' ? 'var(--color-rose-500)' : 'var(--color-rose-400)',
    },
    {
      key: 'futureFocus',
      label: t.futureFocus,
      icon: FastForward,
      color: theme === 'light' ? 'var(--color-violet-600)' : 'var(--color-violet-500)',
    },
    {
      key: 'selfReflection',
      label: t.selfReflection,
      icon: User,
      color: theme === 'light' ? 'var(--color-emerald-600)' : 'var(--color-emerald-500)',
    },
    {
      key: 'resilience',
      label: t.resilience,
      icon: Shield,
      color: theme === 'light' ? 'var(--color-amber-600)' : 'var(--color-amber-500)',
    },
  ];

  const size = 200;
  const center = size / 2;
  const radius = size * 0.35;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
    const r = (value / 10) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const points = dimensions.map((d, i) => getPoint(i, metrics[d.key] || 0));
  const polygonPath = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col md:flex-row items-center gap-8 py-4">
      <div className="relative w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] flex-shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
          {[0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
            <circle
              key={tick}
              cx={center}
              cy={center}
              r={radius * tick}
              fill="none"
              stroke={
                theme === 'light'
                  ? 'color-mix(in srgb, var(--color-vector-cyan-brand) 10%, transparent)'
                  : 'color-mix(in srgb, var(--color-vector-cyan-pure) 10%, transparent)'
              }
              strokeWidth="1"
            />
          ))}

          {dimensions.map((_, i) => {
            const p = getPoint(i, 10);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={p.x}
                y2={p.y}
                stroke={
                  theme === 'light'
                    ? 'color-mix(in srgb, var(--color-vector-cyan-brand) 15%, transparent)'
                    : 'color-mix(in srgb, var(--color-vector-cyan-pure) 20%, transparent)'
                }
                strokeWidth="1"
              />
            );
          })}

          <motion.polygon
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            points={polygonPath}
            fill={
              theme === 'light'
                ? 'color-mix(in srgb, var(--color-vector-cyan-brand) 10%, transparent)'
                : 'color-mix(in srgb, var(--color-vector-cyan-pure) 20%, transparent)'
            }
            stroke={
              theme === 'light' ? 'var(--color-vector-cyan-brand)' : 'var(--color-vector-cyan-pure)'
            }
            strokeWidth="2"
          />

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill={
                theme === 'light'
                  ? 'var(--color-vector-cyan-brand)'
                  : 'var(--color-vector-cyan-pure)'
              }
            />
          ))}
        </svg>

        {dimensions.map((d, i) => {
          const p = getPoint(i, 13);
          const Icon = d.icon;
          return (
            <div
              key={i}
              className="absolute flex flex-col items-center gap-0.5"
              style={{
                left: `${(p.x / size) * 100}%`,
                top: `${(p.y / size) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <Icon className="w-3 h-3" style={{ color: d.color }} />
              <span className="text-[8px] font-mono whitespace-nowrap opacity-60 uppercase tracking-tighter">
                {d.label}
              </span>
              <span className="text-[10px] font-bold font-mono" style={{ color: d.color }}>
                {metrics[d.key] || 0}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 grid grid-cols-1 gap-2 w-full">
        {dimensions.map((d, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest">
              <span className="flex items-center gap-1 opacity-70">
                <d.icon className="w-2.5 h-2.5" style={{ color: d.color }} />
                {d.label}
              </span>
              <span style={{ color: d.color }}>{metrics[d.key] || 0}/10</span>
            </div>
            <div
              className={`h-1 rounded-full overflow-hidden border ${theme === 'light' ? 'bg-[color-mix(in_srgb,_var(--color-vector-cyan-brand)_5%,_transparent)] border-[color-mix(in_srgb,_var(--color-vector-cyan-brand)_10%,_transparent)]' : 'bg-cyan-950/30 border-cyan-900/20'}`}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(metrics[d.key] || 0) * 10}%` }}
                className="h-full"
                style={{ backgroundColor: d.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

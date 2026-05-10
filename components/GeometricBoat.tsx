import React from 'react';
import { Theme } from '../types';

interface GeometricBoatProps {
  className?: string;
  theme: Theme;
  /** Hero CTA: hull / mast / sails share `currentColor` from the SVG `className` for a single ink. */
  variant?: 'default' | 'hero';
}

export const GeometricBoat: React.FC<GeometricBoatProps> = ({
  className,
  theme,
  variant = 'default',
}) => {
  const hero = variant === 'hero';
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <polygon
        points="20,70 80,70 65,85 35,85"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line
        x1="50"
        y1="18"
        x2="50"
        y2="70"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={hero ? undefined : theme === 'light' ? 'text-cyan-600' : 'text-indigo-500'}
      />
      <polygon
        points="52,22 52,65 76,65"
        fill={hero ? 'currentColor' : 'var(--color-cyan-600)'}
        fillOpacity={hero ? 0.24 : 0.4}
        stroke={hero ? 'currentColor' : 'var(--color-cyan-500)'}
        strokeOpacity={hero ? 0.5 : 1}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon
        points="48,32 48,65 30,65"
        fill={hero ? 'currentColor' : 'var(--color-cyan-600)'}
        fillOpacity={hero ? 0.1 : 0.1}
        stroke={hero ? 'currentColor' : 'var(--color-cyan-500)'}
        strokeOpacity={hero ? 0.42 : 1}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
};

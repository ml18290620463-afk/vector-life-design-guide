import React, { useEffect, useRef } from 'react';
import { ARCHIVE_PARTICLE_COLORS, withAlpha, ARCHIVE_RGB } from '../lib/canvasPalette';

interface Point {
  x: number;
  y: number;
}

interface Particle {
  start: Point;
  end: Point;
  progress: number;
  speed: number;
  color: string;
  width: number;
  curve: number;
}

import { Theme } from '../types';

interface DeepArchiveAnimationProps {
  theme: Theme;
  onComplete?: () => void;
}

export const DeepArchiveAnimation: React.FC<DeepArchiveAnimationProps> = ({
  theme,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const startTime = Date.now();
    const duration = 3000; // 3 seconds for the animation

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Central Vault Position
    const vaultPos = { x: canvas.width * 0.7, y: canvas.height * 0.45 };

    // Generate Particles
    const particles: Particle[] = [];
    const particleCount = 40;
    const colors = ARCHIVE_PARTICLE_COLORS;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        start: {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
        },
        end: vaultPos,
        progress: -Math.random() * 0.5, // Staggered start
        speed: 0.005 + Math.random() * 0.01,
        color: colors[Math.floor(Math.random() * colors.length)],
        width: 1 + Math.random() * 2,
        curve: (Math.random() - 0.5) * 400,
      });
    }

    const drawDataConstellation = (opacity: number) => {
      ctx.save();
      ctx.strokeStyle = withAlpha('cyan', 0.15 * opacity);
      ctx.lineWidth = 1;

      // Abstract data grid instead of world map
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
      }

      // Labels based on keyInfo
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = withAlpha('cyan', 0.6 * opacity);

      const defaultLabels: [string, string, number, number][] = [
        ['日期', '2026/03/30', 0.2, 0.2],
        ['情绪', 'STABLE', 0.3, 0.5],
        ['目标', 'ARCHIVE', 0.5, 0.2],
        ['需求', 'SECURITY', 0.4, 0.7],
        ['困扰', 'NONE', 0.6, 0.8],
      ];

      defaultLabels.forEach(([label, value, x, y]) => {
        const posX = x * canvas.width;
        const posY = y * canvas.height;

        // Draw Label
        ctx.fillStyle = withAlpha('cyan', 0.3 * opacity);
        ctx.fillText(label, posX, posY - 15);

        // Draw Value
        ctx.fillStyle = withAlpha('white', 0.8 * opacity);
        ctx.font = 'bold 14px monospace';
        ctx.fillText(value.toUpperCase(), posX, posY);

        // Draw Point
        ctx.beginPath();
        ctx.arc(posX - 10, posY - 5, 3, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha('cyan', opacity);
        ctx.fill();
      });

      ctx.restore();
    };

    const drawVault = (time: number, opacity: number) => {
      const pulse = Math.sin(time * 0.005) * 10;
      const baseRadius = 40;

      ctx.save();
      ctx.translate(vaultPos.x, vaultPos.y);

      // Outer Rings - Multi-colored and glowing. Order is cyan → magenta
      // → yellow → green to keep the same cyclic feel as the pre-token
      // implementation.
      const ringColors = [
        ARCHIVE_PARTICLE_COLORS[1],
        ARCHIVE_PARTICLE_COLORS[0],
        ARCHIVE_PARTICLE_COLORS[2],
        ARCHIVE_PARTICLE_COLORS[3],
      ];
      for (let i = 0; i < 8; i++) {
        const r = baseRadius + i * 12 + pulse * (i + 1) * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = ringColors[i % ringColors.length];
        ctx.globalAlpha = 0.2 * (1 - i / 8) * opacity;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = ringColors[i % ringColors.length];
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Inner Core - Pulsating Magenta/Cyan
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius + pulse);
      gradient.addColorStop(0, withAlpha('magenta', 0.9 * opacity));
      gradient.addColorStop(0.4, withAlpha('magenta', 0.6 * opacity));
      gradient.addColorStop(0.7, withAlpha('cyan', 0.3 * opacity));
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Center Point
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();

      ctx.restore();
    };

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const globalOpacity =
        elapsed < 500 ? elapsed / 500 : elapsed > duration - 500 ? (duration - elapsed) / 500 : 1;

      if (elapsed > duration) {
        if (onComplete) onComplete();
        return;
      }

      ctx.fillStyle = theme === 'light' ? `rgb(${ARCHIVE_RGB.paperLight})` : 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawDataConstellation(globalOpacity);
      drawVault(now, globalOpacity);

      // Draw Particles
      particles.forEach((p) => {
        if (p.progress < 0) {
          p.progress += p.speed;
          return;
        }
        if (p.progress > 1) return;

        const t = p.progress;

        // Quadratic Bezier Curve
        const cp = {
          x: (p.start.x + p.end.x) / 2 + p.curve,
          y: (p.start.y + p.end.y) / 2 - Math.abs(p.curve),
        };

        const x = (1 - t) * (1 - t) * p.start.x + 2 * (1 - t) * t * cp.x + t * t * p.end.x;
        const y = (1 - t) * (1 - t) * p.start.y + 2 * (1 - t) * t * cp.y + t * t * p.end.y;

        // Draw Trail
        ctx.beginPath();
        ctx.moveTo(p.start.x, p.start.y);
        // We can't easily draw the whole curve with varying opacity, so we draw segments or just the head

        // Let's draw a short trail
        const trailLength = 0.1;
        const startT = Math.max(0, t - trailLength);

        ctx.beginPath();
        const sx =
          (1 - startT) * (1 - startT) * p.start.x +
          2 * (1 - startT) * startT * cp.x +
          startT * startT * p.end.x;
        const sy =
          (1 - startT) * (1 - startT) * p.start.y +
          2 * (1 - startT) * startT * cp.y +
          startT * startT * p.end.y;

        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cp.x, cp.y, x, y);

        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        ctx.globalAlpha = (1 - t) * globalOpacity;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Draw Head
        ctx.beginPath();
        ctx.arc(x, y, p.width + 1, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        p.progress += p.speed;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
    // Animation runs once per mount; theme is read elsewhere via className.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 z-[200] ${theme === 'light' ? 'bg-slate-50' : 'bg-black'}`}
      style={{ cursor: 'none' }}
    />
  );
};

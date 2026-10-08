import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { useMotionPreference } from '../hooks/useMotionPreference';

interface ValleyParticleLandscapeProps {
  className?: string;
  /** Target particle budget; mobile/reduced budgets are derived from this. */
  particleBudget?: number;
}

type Side = 'left' | 'right';

type MarkKind = 'stipple' | 'hatch' | 'blade';

interface GreenParticle {
  side: Side;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  birth: number;
  life: number;
  size: number;
  alpha: number;
  color: [number, number, number];
  kind: MarkKind;
  angle: number;
  jitter: number;
}

const GREEN_PALETTE: [number, number, number][] = [
  [120, 158, 72],
  [86, 128, 54],
  [58, 96, 42],
  [148, 176, 78],
  [72, 112, 48],
  [102, 142, 62],
  [44, 78, 36],
  [168, 186, 96],
  [92, 118, 52],
  [130, 148, 64],
  [110, 96, 48],
  [176, 168, 98],
];

const SKY_TOP: [number, number, number] = [186, 196, 204];
const SKY_MID: [number, number, number] = [208, 212, 214];
const SKY_HORIZON: [number, number, number] = [220, 222, 222];
const HILL_FAR: [number, number, number] = [158, 172, 158];
const HILL_MID: [number, number, number] = [132, 154, 118];
const RIVER_DEEP: [number, number, number] = [108, 136, 152];
const RIVER_MID: [number, number, number] = [148, 172, 184];
const RIVER_LIGHT: [number, number, number] = [204, 218, 224];

/** S-curve river centerline in normalized coordinates (0–1). */
const riverCenterNorm = (yNorm: number): number => {
  const t = Math.max(0, Math.min(1, yNorm));
  const sway =
    Math.sin(t * Math.PI * 2.35) * 0.155 +
    Math.sin(t * Math.PI * 1.15 + 0.4) * 0.07 -
    Math.sin(t * Math.PI * 3.1) * 0.025;
  // Wider wander in the lower half; settles toward center near horizon.
  return 0.5 + sway * (0.35 + t * 0.85);
};

const riverHalfWidthNorm = (yNorm: number): number => {
  const t = Math.max(0, Math.min(1, yNorm));
  // Narrow near horizon (~0.55–0.62), open in the foreground.
  const horizon = 0.028;
  const fore = 0.14;
  return horizon + (fore - horizon) * Math.pow(t, 1.55);
};

const isInsideRiver = (x: number, y: number, w: number, h: number): boolean => {
  const yNorm = y / h;
  if (yNorm < 0.34) return false;
  const cx = riverCenterNorm(yNorm) * w;
  const half = riverHalfWidthNorm(yNorm) * w;
  return Math.abs(x - cx) < half;
};

const vegetationDepth = (x: number, y: number, w: number, h: number): number => {
  const yNorm = y / h;
  if (yNorm < 0.32) return 0;
  const cx = riverCenterNorm(yNorm) * w;
  const half = riverHalfWidthNorm(yNorm) * w;
  const dist = Math.abs(x - cx) - half;
  if (dist < 0) return 0;
  // Soft bank falloff — denser near banks and outer edges.
  const bank = Math.min(1, dist / (w * 0.08));
  const edge = Math.min(x, w - x) / (w * 0.5);
  const fore = Math.pow(yNorm, 1.35);
  return Math.min(1, bank * 0.55 + (1 - edge) * 0.35 + fore * 0.45);
};

/**
 * Watercolor valley backdrop: sky + distant hills + S-curve river are painted
 * once; greenery is living particles that drift in from the left/right edges.
 */
export const ValleyParticleLandscape: React.FC<ValleyParticleLandscapeProps> = ({
  className = '',
  particleBudget = 2800,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useMotionPreference();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let instance: p5 | null = null;

    const sketch = (p: p5) => {
      let particles: GreenParticle[] = [];
      let buffer: p5.Graphics | null = null;
      let spawnCursor = 0;
      let lastW = 0;
      let lastH = 0;

      const budget = () => {
        const mobile = p.width < 720;
        const base = mobile ? Math.floor(particleBudget * 0.55) : particleBudget;
        return reduceMotion ? Math.floor(base * 0.45) : base;
      };

      const pickColor = (): [number, number, number] => {
        const c = GREEN_PALETTE[Math.floor(p.random(GREEN_PALETTE.length))];
        return [c[0] + p.random(-10, 10), c[1] + p.random(-10, 10), c[2] + p.random(-8, 8)];
      };

      const makeParticle = (side: Side, instant: boolean): GreenParticle => {
        const y = p.random(p.height * 0.34, p.height * 1.02);
        const yNorm = y / p.height;
        const cx = riverCenterNorm(yNorm) * p.width;
        const half = riverHalfWidthNorm(yNorm) * p.width;
        const bankGap = p.random(4, p.width * (0.04 + yNorm * 0.1));
        const leftBank = Math.max(8, cx - half - bankGap);
        const rightBank = Math.min(p.width - 8, cx + half + bankGap);
        const edgeX = side === 'left' ? p.random(-18, 6) : p.random(p.width - 6, p.width + 18);
        // Prefer outer thirds, then ease toward the riverbank.
        const homeX =
          side === 'left'
            ? p.lerp(p.random(0, leftBank * 0.45), leftBank, p.random(0.35, 1))
            : p.lerp(
                rightBank,
                p.random(rightBank + (p.width - rightBank) * 0.55, p.width),
                p.random(0.35, 1),
              );
        const clampedHome = p.constrain(
          homeX,
          side === 'left' ? 0 : cx + half + 2,
          side === 'left' ? cx - half - 2 : p.width,
        );
        const kindRoll = p.random();
        const kind: MarkKind =
          yNorm > 0.78 && kindRoll > 0.55 ? 'blade' : kindRoll > 0.4 ? 'hatch' : 'stipple';

        const birth = instant ? 0 : p.random(0, 6.5);
        return {
          side,
          homeX: clampedHome,
          homeY: y + p.random(-6, 6),
          x: edgeX,
          y: y + p.random(-4, 4),
          vx: side === 'left' ? p.random(0.22, 0.55) : -p.random(0.22, 0.55),
          birth,
          life: instant ? 1 : 0,
          size:
            kind === 'blade'
              ? p.random(5, 14) * (0.75 + yNorm)
              : p.random(1.4, 4.2) * (0.7 + yNorm * 0.75),
          alpha: p.random(0.55, 0.98),
          color: pickColor(),
          kind,
          angle: p.random(-p.PI, p.PI),
          jitter: p.random(0.15, 0.85),
        };
      };

      const seedParticles = (instant: boolean) => {
        const n = budget();
        particles = [];
        for (let i = 0; i < n; i++) {
          const side: Side = i % 2 === 0 ? 'left' : 'right';
          const particle = makeParticle(side, instant);
          // Bias density: more in foreground + outer thirds.
          const depth = vegetationDepth(particle.homeX, particle.homeY, p.width, p.height);
          if (depth < 0.18 && p.random() > 0.35) continue;
          if (depth < 0.4 && p.random() > 0.55) continue;
          particles.push(particle);
        }
        spawnCursor = 0;
      };

      const paintStaticScene = () => {
        if (!buffer) return;
        const g = buffer;
        const w = g.width;
        const h = g.height;

        // Sky wash
        for (let y = 0; y < h; y++) {
          const t = y / h;
          let r: number;
          let green: number;
          let b: number;
          if (t < 0.42) {
            const u = t / 0.42;
            r = p.lerp(SKY_TOP[0], SKY_MID[0], u);
            green = p.lerp(SKY_TOP[1], SKY_MID[1], u);
            b = p.lerp(SKY_TOP[2], SKY_MID[2], u);
          } else {
            const u = (t - 0.42) / 0.58;
            r = p.lerp(SKY_MID[0], SKY_HORIZON[0], u);
            green = p.lerp(SKY_MID[1], SKY_HORIZON[1], u);
            b = p.lerp(SKY_MID[2], SKY_HORIZON[2], u);
          }
          g.stroke(r, green, b);
          g.line(0, y, w, y);
        }

        // Soft cloud bands
        g.noStroke();
        for (let i = 0; i < 26; i++) {
          const cx = p.random(w);
          const cy = p.random(h * 0.05, h * 0.38);
          const rw = p.random(w * 0.12, w * 0.34);
          const rh = p.random(h * 0.02, h * 0.06);
          g.fill(230, 232, 234, p.random(18, 46));
          g.ellipse(cx, cy, rw, rh);
        }

        // Distant hills
        g.noStroke();
        g.fill(HILL_FAR[0], HILL_FAR[1], HILL_FAR[2], 210);
        g.beginShape();
        g.vertex(0, h * 0.46);
        for (let x = 0; x <= w; x += 12) {
          const n = p.noise(x * 0.004, 1.2);
          g.vertex(x, h * (0.4 + n * 0.08));
        }
        g.vertex(w, h);
        g.vertex(0, h);
        g.endShape(g.CLOSE);

        g.fill(HILL_MID[0], HILL_MID[1], HILL_MID[2], 175);
        g.beginShape();
        g.vertex(0, h * 0.56);
        for (let x = 0; x <= w; x += 10) {
          const n = p.noise(x * 0.0055, 3.7);
          g.vertex(x, h * (0.48 + n * 0.1));
        }
        g.vertex(w, h);
        g.vertex(0, h);
        g.endShape(g.CLOSE);

        // Soft bank underpaint so empty banks don't look barren before particles arrive
        for (let y = h * 0.38; y < h; y += 2) {
          const yNorm = y / h;
          const cx = riverCenterNorm(yNorm) * w;
          const half = riverHalfWidthNorm(yNorm) * w;
          const band = 18 + yNorm * 70;
          g.noStroke();
          g.fill(118, 148, 78, 16 + yNorm * 28);
          g.rect(0, y, Math.max(0, cx - half - 2), 2);
          g.rect(cx + half + 2, y, Math.max(0, w - (cx + half + 2)), 2);
          g.fill(96, 128, 62, 10 + yNorm * 18);
          g.rect(Math.max(0, cx - half - band), y, band * 0.55, 2);
          g.rect(cx + half + 2, y, band * 0.55, 2);
        }

        // River body
        g.noStroke();
        const riverSteps = Math.ceil(h * 0.7);
        for (let i = 0; i < riverSteps; i++) {
          const y = h * 0.34 + (i / riverSteps) * h * 0.72;
          const yNorm = y / h;
          const cx = riverCenterNorm(yNorm) * w;
          const half = riverHalfWidthNorm(yNorm) * w;
          const shade = yNorm;
          const r = p.lerp(RIVER_LIGHT[0], RIVER_DEEP[0], shade);
          const gre = p.lerp(RIVER_LIGHT[1], RIVER_DEEP[1], shade);
          const b = p.lerp(RIVER_LIGHT[2], RIVER_DEEP[2], shade);
          g.fill(r, gre, b, 230);
          g.ellipse(cx, y, half * 2.15, Math.max(3, h * 0.012));
          // Highlight streak
          g.fill(RIVER_LIGHT[0], RIVER_LIGHT[1], RIVER_LIGHT[2], 40 + (1 - shade) * 50);
          g.ellipse(cx - half * 0.15, y, half * 0.9, Math.max(2, h * 0.006));
        }

        // Soft river edge wash
        for (let y = h * 0.36; y < h; y += 3) {
          const yNorm = y / h;
          const cx = riverCenterNorm(yNorm) * w;
          const half = riverHalfWidthNorm(yNorm) * w;
          g.stroke(RIVER_MID[0], RIVER_MID[1], RIVER_MID[2], 28);
          g.strokeWeight(2);
          g.point(cx - half, y);
          g.point(cx + half, y);
        }

        // Paper grain
        g.noStroke();
        for (let i = 0; i < Math.floor(w * h * 0.008); i++) {
          g.fill(255, 255, 255, p.random(4, 14));
          g.circle(p.random(w), p.random(h), p.random(0.6, 1.6));
        }
      };

      const drawParticle = (particle: GreenParticle) => {
        const appear = reduceMotion ? 1 : p.constrain((particle.life - 0.05) / 0.85, 0, 1);
        if (appear <= 0.01) return;
        const [r, g, b] = particle.color;
        const a = particle.alpha * appear * 255;
        const breathe = reduceMotion
          ? 0
          : Math.sin(p.frameCount * 0.012 + particle.angle) * particle.jitter * 0.35;

        p.push();
        p.translate(particle.x + breathe, particle.y);
        p.rotate(
          particle.kind === 'blade' ? -p.HALF_PI + particle.angle * 0.08 : particle.angle * 0.15,
        );

        if (particle.kind === 'blade') {
          p.stroke(r, g, b, a);
          p.strokeWeight(Math.max(0.7, particle.size * 0.18));
          p.line(0, 0, p.sin(particle.angle) * 1.2, -particle.size);
          if (particle.size > 7) {
            p.stroke(r + 20, g + 24, b + 8, a * 0.55);
            p.line(0.6, -particle.size * 0.2, 1.2, -particle.size * 0.75);
          }
        } else if (particle.kind === 'hatch') {
          p.stroke(r, g, b, a);
          p.strokeWeight(Math.max(0.6, particle.size * 0.35));
          const len = particle.size * 1.6;
          p.line(-len * 0.5, 0, len * 0.5, len * 0.15);
          if (particle.jitter > 0.45) {
            p.stroke(r - 12, g - 8, b - 6, a * 0.55);
            p.line(-len * 0.2, 1.2, len * 0.35, 1.8);
          }
        } else {
          p.noStroke();
          p.fill(r, g, b, a);
          p.circle(0, 0, particle.size);
          p.fill(r + 18, g + 22, b + 10, a * 0.45);
          p.circle(particle.size * 0.15, -particle.size * 0.12, particle.size * 0.55);
        }
        p.pop();
      };

      const rebuild = () => {
        const w = host.clientWidth || window.innerWidth;
        const h = host.clientHeight || window.innerHeight;
        if (w < 2 || h < 2) return;
        p.resizeCanvas(w, h);
        if (buffer) buffer.remove();
        buffer = p.createGraphics(w, h);
        buffer.pixelDensity(1);
        paintStaticScene();
        seedParticles(reduceMotion);
        lastW = w;
        lastH = h;
      };

      p.setup = () => {
        const w = host.clientWidth || window.innerWidth;
        const h = host.clientHeight || window.innerHeight;
        const canvas = p.createCanvas(w, h);
        canvas.style('display', 'block');
        canvas.style('width', '100%');
        canvas.style('height', '100%');
        p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        p.frameRate(reduceMotion ? 20 : 30);
        rebuild();
      };

      p.windowResized = () => {
        const w = host.clientWidth || window.innerWidth;
        const h = host.clientHeight || window.innerHeight;
        if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
        rebuild();
      };

      p.draw = () => {
        if (buffer) {
          p.image(buffer, 0, 0, p.width, p.height);
        } else {
          p.background(SKY_MID[0], SKY_MID[1], SKY_MID[2]);
        }

        const t = p.millis() / 1000;

        for (let i = 0; i < particles.length; i++) {
          const particle = particles[i];
          if (!reduceMotion && t < particle.birth) continue;

          if (reduceMotion) {
            particle.x = particle.homeX;
            particle.y = particle.homeY;
            particle.life = 1;
          } else {
            const targetX = particle.homeX;
            const targetY = particle.homeY;
            // Ease from edge toward home; never enter the river.
            particle.x += (targetX - particle.x) * 0.028 + particle.vx * 0.12;
            particle.y += (targetY - particle.y) * 0.02;
            if (isInsideRiver(particle.x, particle.y, p.width, p.height)) {
              particle.x = targetX;
              particle.y = targetY;
            }
            particle.life = Math.min(1, particle.life + 0.01);
            // Gentle idle drift once settled
            if (particle.life > 0.85) {
              particle.x += Math.sin(t * 0.35 + particle.angle) * 0.04 * particle.jitter;
              particle.y += Math.cos(t * 0.28 + particle.angle * 1.3) * 0.025 * particle.jitter;
            }
          }

          drawParticle(particle);
        }

        // Slow continuous replenishment from the sides
        if (!reduceMotion && particles.length > 0) {
          spawnCursor += 0.35;
          while (spawnCursor >= 1) {
            spawnCursor -= 1;
            const side: Side = p.random() > 0.5 ? 'left' : 'right';
            const next = makeParticle(side, false);
            next.birth = t;
            next.life = 0;
            // Replace a random settled particle to keep budget stable
            const idx = Math.floor(p.random(particles.length));
            if (particles[idx].life > 0.9) {
              particles[idx] = next;
            }
          }
        }

        // Light edge vignette — keep the valley readable under cover UI
        p.noFill();
        for (let i = 0; i < 6; i++) {
          const a = 3 + i * 2;
          p.stroke(28, 36, 40, a);
          p.strokeWeight(14);
          p.rect(6 + i * 5, 6 + i * 5, p.width - 12 - i * 10, p.height - 12 - i * 10, 2);
        }
      };
    };

    instance = new p5(sketch, host);

    return () => {
      instance?.remove();
      instance = null;
    };
  }, [particleBudget, reduceMotion]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      data-testid="valley-particle-landscape"
    />
  );
};

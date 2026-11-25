import React, { useEffect, useRef, useState } from 'react';

interface CharmeuseSilkBackdropProps {
  disabled?: boolean;
}

export const CharmeuseSilkBackdrop: React.FC<CharmeuseSilkBackdropProps> = ({
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 860 : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 860px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (disabled || !isDesktop) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const W = 720;
    const H = 450;
    canvas.width = W;
    canvas.height = H;

    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;
    const heightField = new Float32Array(W * H);
    const microSheen = new Float32Array(W * H);

    const smoothstep = (e0: number, e1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };

    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1);
        const idx = y * W + x;

        const broadDome = 0.24 * Math.sin(Math.PI * (0.52 * u + 0.48 * v));
        const organicBend =
          0.78 * Math.sin(2.15 * u - 1.35 * v + 0.3) +
          0.2 * Math.cos(3.0 * u + 1.9 * v);
        const foldAxis = 3.85 * (0.55 * u + 0.72 * v) + organicBend - 2.25;

        const centerCalmMask =
          1.0 - 0.45 * Math.exp(-((u - 0.5) ** 2 + (v - 0.45) ** 2) / 0.17);
        const rightBottomWeight =
          smoothstep(0.08, 0.96, 0.54 * u + 0.65 * v) * centerCalmMask;

        const primaryFold =
          rightBottomWeight *
          0.38 *
          Math.exp(-(foldAxis * foldAxis) / 0.92) *
          Math.sin(foldAxis * 1.42);

        const twinAxis = foldAxis + 1.62 + 0.2 * Math.sin(2.4 * u + 1.7 * v);
        const twinFold =
          rightBottomWeight *
          0.2 *
          Math.exp(-(twinAxis * twinAxis) / 0.7) *
          Math.sin(twinAxis * 1.48);

        const outerWrapWeight =
          0.3 * (1.0 - smoothstep(0.0, 0.45, u + v)) +
          0.24 * smoothstep(0.7, 1.0, v) * (1.0 - 0.48 * u);
        const wrapAxis =
          4.5 * (0.48 * u - 0.65 * v) + 0.55 * Math.sin(2.6 * u + 1.8 * v);
        const outerFold = outerWrapWeight * 0.22 * Math.sin(wrapAxis);

        heightField[idx] = broadDome + primaryFold + twinFold + outerFold;
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        microSheen[idx] = hash - Math.floor(hash) - 0.5;
      }
    }

    const renderFrame = () => {
      let lx = -0.54;
      let ly = -0.66;
      let lz = 0.52;
      const lLen = Math.hypot(lx, ly, lz);
      lx /= lLen; ly /= lLen; lz /= lLen;

      let hx = lx, hy = ly, hz = lz + 1.0;
      const hLen = Math.hypot(hx, hy, hz);
      hx /= hLen; hy /= hLen; hz /= hLen;

      const bumpStrength = 1.35;

      for (let y = 0; y < H; y++) {
        const yUp = y > 0 ? y - 1 : 0;
        const yDn = y < H - 1 ? y + 1 : H - 1;
        for (let x = 0; x < W; x++) {
          const xLt = x > 0 ? x - 1 : 0;
          const xRt = x < W - 1 ? x + 1 : W - 1;
          const idx = y * W + x;

          const dx =
            (heightField[y * W + xRt] - heightField[y * W + xLt]) *
            0.5 * W * 0.0042 * bumpStrength;
          const dy =
            (heightField[yDn * W + x] - heightField[yUp * W + x]) *
            0.5 * H * 0.0042 * bumpStrength;

          let nx = -dx, ny = -dy, nz = 1.0;
          const invN = 1.0 / Math.hypot(nx, ny, nz);
          nx *= invN; ny *= invN; nz *= invN;

          const ndotl = Math.max(0, nx * lx + ny * ly + nz * lz);
          const ndoth = Math.max(0, nx * hx + ny * hy + nz * hz);

          const satinSheen = Math.pow(ndoth, 11) * 0.38;
          const pearlRidge = Math.pow(ndoth, 34) * 0.42;
          const lum = 0.22 + ndotl * 0.62 + satinSheen + pearlRidge;
          const shimmer = microSheen[idx] * (0.9 + 1.8 * (satinSheen + pearlRidge));

          // 云白珍珠三段色阶：#CFD9EA (207,217,234) -> #E9EEF7 (233,238,247) -> #FFFFFF (255,255,255)
          let r: number, g: number, b: number;
          if (lum < 0.64) {
            const t = Math.max(0, lum / 0.64);
            const st = t * t * (3 - 2 * t);
            r = 207 + (233 - 207) * st;
            g = 217 + (238 - 217) * st;
            b = 234 + (247 - 234) * st;
          } else {
            const t = Math.min(1, (lum - 0.64) / 0.44);
            const st = t * t * (3 - 2 * t);
            r = 233 + (255 - 233) * st;
            g = 238 + (255 - 238) * st;
            b = 247 + (255 - 247) * st;
          }

          const p = idx * 4;
          data[p]     = Math.max(0, Math.min(255, r + shimmer));
          data[p + 1] = Math.max(0, Math.min(255, g + shimmer));
          data[p + 2] = Math.max(0, Math.min(255, b + shimmer * 0.95));
          data[p + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };

    renderFrame();
  }, [disabled, isDesktop]);

  if (disabled || !isDesktop) return null;

  return (
    <div className="charmeuse-backdrop" aria-hidden="true">
    <canvas
      id="charmeuse-canvas"
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        display: 'block',
      }}
    />
    <div className="charmeuse-backdrop__breath" />
    </div>
  );
};

import { useEffect, useRef } from 'react';

// Coordinates share the reference artwork's 1672 × 941 canvas.
export const ribbonCurrent = { duration: 2400, strength: 0.88, lineWidth: 0.8, hitRadius: 24 };
const routes = [
  'M12 852 C205 715 328 703 527 738 C752 786 1015 774 1100 673 C1190 565 1050 471 923 487 C813 496 737 543 768 596 C817 679 1024 613 1158 527 C1339 413 1439 345 1573 201',
  'M32 842 C238 733 367 737 566 751 C793 776 1001 757 1090 661 C1165 576 1045 489 923 499 C814 506 753 551 781 596 C827 652 1028 600 1166 520 C1350 408 1458 320 1573 201',
  'M58 827 C263 704 372 712 561 728 C797 758 1008 751 1108 645 C1172 570 1040 478 930 480 C812 477 735 545 759 591 C795 673 1012 628 1157 541 C1343 427 1454 326 1573 201',
];

export function RibbonCurrent() {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    const stage = svg?.closest('.vector-home-stage');
    if (!svg || !stage) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let animations: Animation[] = [];
    const stop = () => {
      animations.forEach((animation) => animation.cancel());
      animations = [];
    };
    const activate = (event: Event) => {
      const pointer = event as PointerEvent;
      if (pointer.button !== 0 || (event.target as Element).closest('button, a, input')) return;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(pointer.clientX, pointer.clientY).matrixTransform(
        matrix.inverse(),
      );
      const guide = svg.querySelector<SVGPathElement>('[data-current-guide]');
      if (!guide) return;
      const length = guide.getTotalLength();
      let distance = Infinity;
      let start = 0;
      for (let s = 0; s <= length; s += 7) {
        const p = guide.getPointAtLength(s);
        const d = Math.hypot(p.x - point.x, p.y - point.y);
        if (d < distance) {
          distance = d;
          start = s / length;
        }
      }
      // Only the ribbon responds; the page and business entry retain normal interaction.
      const scale = Math.max(0.01, Math.hypot(matrix.a, matrix.b));
      const hitRadius = Math.max(
        ribbonCurrent.hitRadius,
        (pointer.pointerType === 'touch' ? 20 : 10) / scale,
      );
      if (distance > hitRadius) return;
      stop();
      if (media.matches) return;
      svg.querySelectorAll<SVGPathElement>('[data-current-pulse]').forEach((path, index) => {
        if (getComputedStyle(path.parentElement!).display === 'none') return;
        const from = start * 1000;
        const animation = path.animate(
          [
            { strokeDashoffset: -from, opacity: 0 },
            { strokeDashoffset: -(from + 12), opacity: ribbonCurrent.strength, offset: 0.12 },
            { strokeDashoffset: -1000, opacity: ribbonCurrent.strength * 0.7, offset: 0.88 },
            { strokeDashoffset: -1040, opacity: 0 },
          ],
          {
            duration: Math.max(650, ribbonCurrent.duration * (1 - start)),
            delay: index * 95,
            easing: 'linear',
          },
        );
        animations.push(animation);
      });
    };
    let inView = true;
    const visibility = () => {
      const paused = document.hidden || !inView;
      svg.dataset.paused = String(paused);
      if (paused) stop();
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            visibility();
          });
    observer?.observe(svg);
    visibility();
    stage.addEventListener('pointerdown', activate);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', stop);
    return () => {
      observer?.disconnect();
      stop();
      stage.removeEventListener('pointerdown', activate);
      document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', stop);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="ribbon-current"
      viewBox="0 0 1672 941"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter
          id="ribbon-silver-glow"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="0.65" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient
          id="ribbon-silver-depth"
          x1="0"
          y1="850"
          x2="1580"
          y2="190"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#eff8ff" stopOpacity="0.06" />
          <stop offset=".25" stopColor="#d9e9f7" stopOpacity=".12" />
          <stop offset=".42" stopColor="#e5f1fc" stopOpacity=".24" />
          <stop offset=".6" stopColor="#aac9e0" stopOpacity=".12" />
          <stop offset=".82" stopColor="#f7fcff" stopOpacity=".85" />
          <stop offset="1" stopColor="#f1f9ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {routes.map((d, i) => (
        <g key={d}>
          <path
            d={d}
            data-current-guide={i === 0 ? '' : undefined}
            pathLength="1000"
            fill="none"
            stroke="url(#ribbon-silver-depth)"
            strokeWidth={ribbonCurrent.lineWidth}
            strokeDasharray={`${95 + i * 23} ${24 + i * 7} 37 18`}
            strokeLinecap="round"
          />
          <path
            d={d}
            className={`ribbon-current-ambient ribbon-current-ambient-${i}`}
            pathLength="1000"
            fill="none"
            stroke="url(#ribbon-silver-depth)"
            strokeWidth="0.85"
            filter="url(#ribbon-silver-glow)"
            strokeDasharray="160 1000"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d={d}
            data-current-pulse=""
            filter="url(#ribbon-silver-glow)"
            pathLength="1000"
            fill="none"
            stroke="#f6fcff"
            strokeWidth={ribbonCurrent.lineWidth}
            strokeDasharray="22 1100"
            strokeLinecap="round"
            opacity="0"
          />
        </g>
      ))}
    </svg>
  );
}

import React from 'react';
import { motion } from 'motion/react';

interface KleinBottleFoldSpaceProps {
  compact?: boolean;
  className?: string;
}

const meshRings = Array.from({ length: 38 }, (_, index) => ({
  cx: 508 + Math.sin(index * 0.72) * 22,
  cy: 116 + index * 11.8,
  rx: 58 + Math.sin(index * 0.54) * 17 + Math.min(index, 15) * 1.65,
  ry: 6.3 + (index % 5) * 1.12,
  opacity: 0.18 + (index % 5) * 0.04,
}));

const bodyRings = Array.from({ length: 34 }, (_, index) => ({
  cx: 470 + Math.sin(index * 0.52) * 34,
  cy: 314 + index * 6.8,
  rx: 138 - Math.abs(index - 16.5) * 3.3,
  ry: 16 + (index % 5) * 2.2,
  rotate: -21 + index * 1.15,
  opacity: 0.16 + (index % 5) * 0.035,
}));

const flowThreads = [-84, -70, -56, -42, -28, -14, 0, 14, 28, 42, 56, 70, 84];
const longitudinalMesh = [-96, -82, -68, -54, -40, -27, -14, 0, 14, 27, 40, 54, 68, 82, 96];
const neckMesh = [-44, -36, -28, -20, -12, -5, 5, 12, 20, 28, 36, 44];
const consciousnessReturnPath =
  'M520 126 C580 138 590 220 566 296 C548 354 520 400 514 446 C508 510 598 516 640 472 C684 426 628 386 554 406 C468 430 372 474 356 532 C340 586 454 612 566 586 C690 554 690 474 610 446 C552 426 506 424 506 424';

export const KleinBottleFoldSpace: React.FC<KleinBottleFoldSpaceProps> = ({
  compact = false,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const bodyGradientId = `klein-reference-body-${uid}`;
  const rimGradientId = `klein-reference-rim-${uid}`;
  const purpleGradientId = `klein-reference-purple-${uid}`;
  const glassGradientId = `klein-reference-glass-${uid}`;
  const volumeGradientId = `klein-volume-depth-${uid}`;
  const backVolumeGradientId = `klein-back-volume-${uid}`;
  const glowId = `klein-reference-glow-${uid}`;
  const softGlowId = `klein-reference-soft-glow-${uid}`;
  const meshGlowId = `klein-reference-mesh-glow-${uid}`;
  const consciousnessSeedId = `klein-consciousness-seed-${uid}`;
  const returnPathId = `klein-consciousness-return-${uid}`;
  const flowArrowId = `klein-flow-arrow-${uid}`;
  const visualScale = compact
    ? 'scale-[0.82] max-sm:scale-[0.68]'
    : 'scale-[0.94] max-sm:scale-[0.72]';

  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-[#020715] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_53%_47%,rgba(8,145,178,0.38),rgba(4,15,39,0.74)_42%,rgba(0,0,0,0.96)_86%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(10,28,62,0.62),rgba(2,7,21,0.9)_52%,rgba(0,0,0,0.98))]" />
      <div className="absolute inset-[1.1rem] rounded-md border border-cyan-100/14 shadow-[inset_0_0_34px_rgba(56,189,248,0.14)] max-sm:inset-3" />

      <motion.div
        className="absolute left-1/2 top-1/2 h-[78vmin] w-[78vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/18 blur-3xl"
        animate={{ opacity: [0.48, 0.74, 0.54], scale: [0.98, 1.05, 0.99] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-[56%] top-[20%] h-[34vmin] w-[30vmin] rounded-full bg-violet-400/28 blur-3xl"
        animate={{ opacity: [0.32, 0.58, 0.36] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.svg
        viewBox="0 0 1000 720"
        preserveAspectRatio="xMidYMid slice"
        className={`absolute inset-0 h-full w-full ${visualScale}`}
        animate={{ scale: [1, 1.006, 1] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          <linearGradient id={bodyGradientId} x1="260" y1="610" x2="646" y2="120">
            <stop offset="0%" stopColor="rgba(240,249,255,0.64)" />
            <stop offset="38%" stopColor="rgba(34,211,238,0.92)" />
            <stop offset="70%" stopColor="rgba(129,140,248,0.82)" />
            <stop offset="100%" stopColor="rgba(216,180,254,0.9)" />
          </linearGradient>
          <linearGradient id={rimGradientId} x1="320" y1="560" x2="650" y2="170">
            <stop offset="0%" stopColor="rgba(255,255,255,0.82)" />
            <stop offset="42%" stopColor="rgba(103,232,249,1)" />
            <stop offset="100%" stopColor="rgba(233,213,255,0.92)" />
          </linearGradient>
          <linearGradient id={purpleGradientId} x1="478" y1="112" x2="612" y2="448">
            <stop offset="0%" stopColor="rgba(192,132,252,0.82)" />
            <stop offset="46%" stopColor="rgba(59,130,246,0.5)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.2)" />
          </linearGradient>
          <radialGradient id={glassGradientId} cx="48%" cy="56%" r="48%">
            <stop offset="0%" stopColor="rgba(103,232,249,0.24)" />
            <stop offset="48%" stopColor="rgba(14,165,233,0.14)" />
            <stop offset="100%" stopColor="rgba(79,70,229,0.02)" />
          </radialGradient>
          <radialGradient id={volumeGradientId} cx="45%" cy="38%" r="68%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="28%" stopColor="rgba(103,232,249,0.12)" />
            <stop offset="60%" stopColor="rgba(14,165,233,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </radialGradient>
          <linearGradient id={backVolumeGradientId} x1="270" y1="620" x2="650" y2="120">
            <stop offset="0%" stopColor="rgba(0,0,0,0.44)" />
            <stop offset="48%" stopColor="rgba(15,23,42,0.16)" />
            <stop offset="100%" stopColor="rgba(103,232,249,0.08)" />
          </linearGradient>
          <radialGradient id={consciousnessSeedId} cx="50%" cy="50%" r="58%">
            <stop offset="0%" stopColor="rgba(240,249,255,0.88)" />
            <stop offset="34%" stopColor="rgba(103,232,249,0.54)" />
            <stop offset="72%" stopColor="rgba(129,140,248,0.24)" />
            <stop offset="100%" stopColor="rgba(20,184,166,0)" />
          </radialGradient>
          <linearGradient id={returnPathId} x1="520" y1="126" x2="640" y2="586">
            <stop offset="0%" stopColor="rgba(103,232,249,0)" />
            <stop offset="34%" stopColor="rgba(103,232,249,0.38)" />
            <stop offset="68%" stopColor="rgba(129,140,248,0.34)" />
            <stop offset="100%" stopColor="rgba(216,180,254,0)" />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feGaussianBlur stdDeviation="13" result="wideBlur" />
            <feMerge>
              <feMergeNode in="wideBlur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={softGlowId}>
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={meshGlowId}>
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feGaussianBlur stdDeviation="8" result="wideBlur" />
            <feMerge>
              <feMergeNode in="wideBlur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id={flowArrowId}
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="6"
            refY="4"
            viewBox="0 0 8 8"
          >
            <path d="M1 1 L7 4 L1 7" fill="none" stroke="rgba(186,230,253,0.72)" strokeWidth="1.2" />
          </marker>
        </defs>

        <motion.path
          d="M510 112 C586 108 620 162 602 244 C585 320 576 361 632 408 C690 458 648 564 532 585 C428 604 332 552 304 470 C276 390 315 312 396 304 C455 298 492 326 516 376 C496 309 475 238 486 170 C491 137 498 119 510 112 Z"
          fill={`url(#${glassGradientId})`}
          opacity="0.9"
        />
        <motion.path
          d="M390 307 C330 320 287 382 301 456 C319 548 416 604 532 584 C634 566 685 476 630 410 C585 356 565 334 583 249 C601 164 584 112 518 110 C462 108 442 154 448 224 C455 300 500 365 522 426 C493 366 457 306 390 307 Z"
          fill={`url(#${backVolumeGradientId})`}
          opacity="0.72"
        />
        <motion.path
          d="M510 112 C586 108 620 162 602 244 C585 320 576 361 632 408 C690 458 648 564 532 585 C428 604 332 552 304 470 C276 390 315 312 396 304 C455 298 492 326 516 376 C496 309 475 238 486 170 C491 137 498 119 510 112 Z"
          fill={`url(#${volumeGradientId})`}
          opacity="0.54"
          animate={{ opacity: [0.46, 0.64, 0.5] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M390 307 C330 320 287 382 301 456 C319 548 416 604 532 584 C634 566 685 476 630 410 C585 356 565 334 583 249 C601 164 584 112 518 110 C462 108 442 154 448 224 C455 300 500 365 522 426 C493 366 457 306 390 307 Z"
          fill="rgba(8,47,73,0.18)"
          stroke={`url(#${bodyGradientId})`}
          strokeWidth="5.2"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
          animate={{ opacity: [0.72, 0.92, 0.76] }}
          transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M390 307 C330 320 287 382 301 456 C319 548 416 604 532 584 C634 566 685 476 630 410 C585 356 565 334 583 249 C601 164 584 112 518 110 C462 108 442 154 448 224 C455 300 500 365 522 426 C493 366 457 306 390 307 Z"
          fill="none"
          stroke="rgba(103,232,249,0.34)"
          strokeWidth="12"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
          opacity="0.42"
        />
        <motion.path
          d="M520 113 C568 119 582 158 567 226 C550 303 553 347 604 392 C645 429 639 490 590 528"
          fill="none"
          stroke={`url(#${purpleGradientId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.42"
          filter={`url(#${softGlowId})`}
        />
        <motion.path
          d="M443 448 C492 405 566 384 628 408 C704 438 660 558 532 584 C421 606 317 548 301 456 C288 378 331 317 393 307 C452 298 492 326 516 376"
          fill="none"
          stroke={`url(#${rimGradientId})`}
          strokeWidth="4.2"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
          animate={{ opacity: [0.58, 0.82, 0.62] }}
          transition={{ duration: 6.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M435 448 C478 414 556 392 616 416 C656 432 654 480 606 515 C558 551 474 554 418 522 C365 492 365 462 435 448 Z"
          fill="rgba(0,0,0,0.5)"
          stroke="rgba(147,197,253,0.28)"
          strokeWidth="2.2"
          opacity="0.92"
        />
        <motion.path
          d="M457 446 C496 421 565 408 612 425 C644 437 634 475 594 499 C548 527 473 526 427 505 C384 485 392 466 457 446 Z"
          fill="none"
          stroke="rgba(125,211,252,0.42)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="8 10"
          animate={{ strokeDashoffset: [0, -48], opacity: [0.3, 0.58, 0.34] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />

        <motion.path
          d="M474 142 C438 214 454 296 498 374 C534 438 500 522 420 552"
          fill="none"
          stroke="rgba(240,249,255,0.42)"
          strokeWidth="1.4"
          strokeLinecap="round"
          filter={`url(#${meshGlowId})`}
          animate={{ opacity: [0.14, 0.46, 0.18] }}
          transition={{ duration: 6.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M604 208 C654 318 658 478 550 565"
          fill="none"
          stroke="rgba(0,0,0,0.46)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.52"
        />

        {longitudinalMesh.map((offset, index) => (
          <motion.path
            key={`longitudinal-mesh-${offset}`}
            d={`M${390 + offset * 0.18} 310 C${420 + offset * 0.42} 344 ${445 + offset * 0.28} 398 ${426 + offset * 0.16} 478 C${414 + offset * 0.22} 548 ${478 + offset * 0.1} 590 ${538 - offset * 0.12} 578 C${632 - offset * 0.16} 560 ${666 + offset * 0.12} 476 ${616 - offset * 0.16} 416 C${560 - offset * 0.22} 352 ${550 + offset * 0.08} 312 ${568 - offset * 0.16} 230 C${582 - offset * 0.08} 164 ${560 + offset * 0.06} 122 ${516 + offset * 0.04} 114`}
            fill="none"
            stroke={index % 2 === 0 ? 'rgba(125,211,252,0.48)' : 'rgba(216,180,254,0.42)'}
            strokeWidth="1.02"
            strokeLinecap="round"
            strokeDasharray={index % 3 === 0 ? '2 6' : '1 5'}
            filter={`url(#${meshGlowId})`}
            animate={{ opacity: [0.22, 0.52, 0.26] }}
            transition={{ duration: 7.8 + index * 0.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {neckMesh.map((offset, index) => (
          <motion.path
            key={`neck-mesh-${offset}`}
            d={`M${514 + offset * 0.18} 116 C${542 + offset * 0.2} 136 ${548 + offset * 0.12} 174 ${540 + offset * 0.02} 224 C${530 - offset * 0.08} 282 ${506 - offset * 0.18} 330 ${514 - offset * 0.16} 382`}
            fill="none"
            stroke={index % 2 === 0 ? 'rgba(216,180,254,0.54)' : 'rgba(125,211,252,0.5)'}
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray="1 6"
            filter={`url(#${meshGlowId})`}
            animate={{ opacity: [0.24, 0.58, 0.28] }}
            transition={{ duration: 7 + index * 0.24, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {meshRings.map((ring, index) => (
          <motion.ellipse
            key={`mesh-ring-${index}`}
            cx={ring.cx}
            cy={ring.cy}
            rx={ring.rx}
            ry={ring.ry}
            fill="none"
            stroke={index > 9 ? 'rgba(125,211,252,0.54)' : 'rgba(216,180,254,0.58)'}
            strokeWidth="1.04"
            strokeDasharray={index % 2 === 0 ? '1 4' : '3 7'}
            opacity={ring.opacity}
            filter={`url(#${meshGlowId})`}
            animate={{ opacity: [ring.opacity, ring.opacity + 0.22, ring.opacity] }}
            transition={{ duration: 7.8 + index * 0.12, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        {bodyRings.map((ring, index) => (
          <motion.ellipse
            key={`body-ring-${index}`}
            cx={ring.cx}
            cy={ring.cy}
            rx={Math.max(ring.rx, 36)}
            ry={ring.ry}
            transform={`rotate(${ring.rotate} ${ring.cx} ${ring.cy})`}
            fill="none"
            stroke={index % 4 === 0 ? 'rgba(216,180,254,0.5)' : 'rgba(125,211,252,0.52)'}
            strokeWidth="1.04"
            strokeDasharray={index % 3 === 0 ? '2 6' : '1 4'}
            filter={`url(#${meshGlowId})`}
            animate={{ opacity: [ring.opacity, ring.opacity + 0.22, ring.opacity] }}
            transition={{ duration: 8.2 + index * 0.15, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        {flowThreads.map((offset, index) => (
          <motion.path
            key={`flow-${offset}`}
            d={`M${392 + offset * 0.18} 314 C${438 + offset * 0.22} 358 ${466 - offset * 0.12} 418 ${432 + offset * 0.2} 492 C${408 + offset * 0.26} 548 ${476 + offset * 0.12} 586 ${536 - offset * 0.08} 576 C${630 - offset * 0.16} 560 ${666 + offset * 0.12} 472 ${614 - offset * 0.12} 416 C${560 - offset * 0.16} 358 ${552 + offset * 0.1} 310 ${568 - offset * 0.18} 230 C${580 - offset * 0.12} 164 ${560 + offset * 0.12} 124 ${516 + offset * 0.06} 114`}
            fill="none"
            stroke={index % 2 === 0 ? 'rgba(103,232,249,0.3)' : 'rgba(192,132,252,0.28)'}
            strokeWidth="1.05"
            strokeLinecap="round"
            strokeDasharray="2 7"
            filter={`url(#${meshGlowId})`}
            markerEnd={index % 4 === 0 ? `url(#${flowArrowId})` : undefined}
            animate={{ opacity: [0.12, 0.34, 0.14] }}
            transition={{ duration: 8.2 + index * 0.32, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        <motion.path
          d={consciousnessReturnPath}
          fill="none"
          stroke={`url(#${returnPathId})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="8 14"
          filter={`url(#${meshGlowId})`}
          markerEnd={`url(#${flowArrowId})`}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1], opacity: [0, 0.5, 0.16], strokeDashoffset: [0, -120] }}
          transition={{ duration: 8.4, ease: 'easeInOut' }}
        />
        <motion.g
          filter={`url(#${softGlowId})`}
          initial={{ offsetDistance: '0%', opacity: 0, scale: 0.32, rotate: -16 }}
          animate={{
            offsetDistance: '100%',
            opacity: [0, 0.88, 0.96],
            scale: [0.32, 0.66, 0.58],
            rotate: [-16, 18, -8, 0],
          }}
          transition={{ duration: 8.4, ease: 'easeInOut' }}
          style={{
            offsetPath: `path("${consciousnessReturnPath}")`,
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        >
          <motion.g
            animate={{ scale: [1, 1.1, 1], opacity: [0.78, 1, 0.82] }}
            transition={{ duration: 4.8, delay: 8.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <circle r="28" fill={`url(#${consciousnessSeedId})`} opacity="0.62" />
            <circle
              r="18"
              fill="rgba(2,7,21,0.58)"
              stroke="rgba(240,249,255,0.78)"
              strokeWidth="1.6"
            />
            <circle
              r="24"
              fill="none"
              stroke="rgba(103,232,249,0.18)"
              strokeWidth="1"
              strokeDasharray="4 8"
            />
            <motion.line
              x1="-12"
              y1="0"
              x2="12"
              y2="0"
              stroke="rgba(123,109,255,0.34)"
              strokeWidth="1.2"
              strokeLinecap="round"
              animate={{ y1: [-8, 8, -8], y2: [-8, 8, -8], opacity: [0, 0.78, 0] }}
              transition={{ duration: 3.7, delay: 8.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <circle
              r="9.2"
              fill="rgba(2,7,21,0.76)"
              stroke="rgba(186,230,253,0.68)"
              strokeWidth="1.1"
            />
            <rect
              x="-5.3"
              y="-5.3"
              width="10.6"
              height="10.6"
              rx="2.2"
              fill="rgba(20,184,166,0.18)"
              stroke="rgba(216,180,254,0.54)"
              strokeWidth="0.9"
            />
            {[-13, 13].map((x) =>
              [-4.8, 0, 4.8].map((y) => (
                <line
                  key={`core-pin-x-${x}-${y}`}
                  x1={x > 0 ? 9.2 : -9.2}
                  y1={y}
                  x2={x}
                  y2={y}
                  stroke="rgba(103,232,249,0.5)"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
              )),
            )}
            {[-13, 13].map((y) =>
              [-4.8, 0, 4.8].map((x) => (
                <line
                  key={`core-pin-y-${x}-${y}`}
                  x1={x}
                  y1={y > 0 ? 9.2 : -9.2}
                  x2={x}
                  y2={y}
                  stroke="rgba(216,180,254,0.42)"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
              )),
            )}
            <path
              d="M-3.2 0h6.4M0 -3.2v6.4"
              fill="none"
              stroke="rgba(224,242,254,0.72)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <motion.circle
              r="16"
              fill="none"
              stroke="rgba(103,232,249,0.2)"
              strokeWidth="1"
              animate={{ r: [14, 24, 14], opacity: [0.36, 0, 0.34] }}
              transition={{ duration: 4.8, delay: 8.4, repeat: Infinity, ease: 'easeOut' }}
            />
          </motion.g>
        </motion.g>

        <motion.path
          d="M516 126 C539 128 550 147 548 178 C544 229 516 276 512 326 C508 386 546 416 604 414"
          fill="none"
          stroke="rgba(224,242,254,0.42)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="5 10"
          animate={{ strokeDashoffset: [0, -42], opacity: [0.22, 0.5, 0.26] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: 'linear' }}
        />
      </motion.svg>
    </div>
  );
};

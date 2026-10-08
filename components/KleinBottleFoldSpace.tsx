import React from 'react';
import { motion } from 'motion/react';

interface KleinBottleFoldSpaceProps {
  compact?: boolean;
  className?: string;
}

const kleinOuterPath =
  'M510 112 C586 108 620 162 602 244 C585 320 576 361 632 408 C690 458 648 564 532 585 C428 604 332 552 304 470 C276 390 315 312 396 304 C455 298 492 326 516 376 C496 309 475 238 486 170 C491 137 498 119 510 112 Z';

const kleinBodyPath =
  'M390 307 C330 320 287 382 301 456 C319 548 416 604 532 584 C634 566 685 476 630 410 C585 356 565 334 583 249 C601 164 584 112 518 110 C462 108 442 154 448 224 C455 300 500 365 522 426 C493 366 457 306 390 307 Z';

const kleinReturnPath =
  'M443 448 C492 405 566 384 628 408 C704 438 660 558 532 584 C421 606 317 548 301 456 C288 378 331 317 393 307 C452 298 492 326 516 376';

const internalDepthPaths = [
  'M520 116 C548 146 548 190 536 242 C522 300 506 340 522 386 C540 438 604 432 628 408',
  'M438 452 C490 414 564 398 618 420 C654 438 644 484 596 514 C548 546 466 544 416 516',
  'M392 310 C448 302 492 328 516 376 C534 418 510 472 462 512 C424 544 382 552 340 528',
];

const structuralFlowPaths = [
  'M510 118 C562 122 584 164 570 226 C554 292 554 346 604 394 C652 438 632 520 548 558',
  'M396 310 C456 304 496 330 520 378 C548 434 524 512 468 550 C420 582 352 556 316 494',
  'M318 456 C358 404 424 386 494 408 C558 428 618 398 654 342',
  'M486 170 C466 244 482 310 526 382 C556 430 594 472 650 496',
  'M304 404 C380 372 452 376 520 414 C588 452 652 448 692 412',
  'M352 542 C432 506 520 514 596 554 C622 568 644 584 662 604',
];

const trunkBranches = [
  {
    key: 'trunk-main',
    d: 'M520 610 C500 560 486 514 496 468 C508 418 552 394 596 374 C628 360 646 334 652 304',
    width: 21,
  },
  {
    key: 'trunk-left',
    d: 'M496 476 C460 440 422 408 382 386 C344 366 322 344 304 316',
    width: 13,
  },
  {
    key: 'trunk-upper',
    d: 'M548 404 C530 350 526 292 542 240 C554 202 542 156 516 114',
    width: 10,
  },
  {
    key: 'trunk-right',
    d: 'M580 390 C628 408 664 444 676 492 C682 526 676 556 658 584',
    width: 12,
  },
  {
    key: 'trunk-low',
    d: 'M512 548 C462 530 410 526 356 542 C326 552 306 568 292 590',
    width: 9,
  },
];

const fineBranches = [
  'M498 468 C454 466 418 452 382 426 C354 406 328 402 304 410',
  'M462 440 C454 408 458 378 480 344 C494 324 494 302 488 282',
  'M410 400 C386 384 366 368 354 342 C344 318 324 306 300 300',
  'M548 404 C522 422 504 444 492 476 C482 504 460 520 430 528',
  'M578 386 C612 378 642 364 668 338 C690 318 714 306 742 304',
  'M624 360 C614 328 614 300 630 270 C646 242 666 224 690 210',
  'M544 276 C512 262 486 242 466 216 C446 190 420 180 390 184',
  'M534 224 C568 216 594 202 616 178 C632 160 650 148 674 142',
  'M526 160 C510 138 492 124 468 116 C448 108 430 96 414 78',
  'M650 500 C622 504 596 516 572 542 C552 562 530 574 504 580',
  'M666 536 C700 536 728 548 750 574',
  'M392 540 C374 510 354 490 326 478 C302 468 280 452 260 430',
  'M356 542 C340 560 324 574 302 582',
  'M600 430 C630 440 654 458 674 486',
  'M454 330 C426 322 400 326 374 344',
  'M574 314 C598 300 616 280 628 254',
];

const branchTips = [
  'M382 426 C368 438 354 446 336 448',
  'M480 344 C466 348 454 356 444 370',
  'M668 338 C684 342 696 352 706 368',
  'M690 210 C706 204 724 202 742 208',
  'M468 116 C462 96 454 80 440 66',
  'M326 478 C312 488 300 500 290 516',
  'M572 542 C584 560 594 580 596 604',
  'M374 344 C352 340 334 344 318 356',
];

const microBranches = [
  'M336 448 C326 442 318 436 312 426',
  'M336 448 C326 454 316 460 304 462',
  'M444 370 C438 382 430 390 418 396',
  'M444 370 C458 376 470 386 478 400',
  'M706 368 C720 368 734 374 746 386',
  'M706 368 C700 382 694 394 682 402',
  'M742 208 C754 218 762 230 766 246',
  'M742 208 C754 200 768 198 782 204',
  'M440 66 C426 58 416 48 408 34',
  'M440 66 C444 50 444 38 438 24',
  'M290 516 C278 526 268 538 262 552',
  'M290 516 C276 512 264 506 252 496',
  'M596 604 C604 618 608 632 606 650',
  'M596 604 C580 614 568 626 560 642',
  'M318 356 C304 360 292 368 282 380',
  'M318 356 C306 348 292 342 276 342',
  'M628 254 C640 244 650 232 656 216',
  'M628 254 C642 260 654 270 664 284',
  'M674 486 C686 492 696 502 704 516',
  'M674 486 C666 500 658 512 646 522',
];

const nanoBranches = [
  'M312 426 C306 420 302 414 300 406',
  'M312 426 C304 428 298 430 290 428',
  'M304 462 C296 466 288 472 282 480',
  'M418 396 C410 398 402 402 396 410',
  'M418 396 C412 388 406 382 398 378',
  'M478 400 C488 406 496 414 502 424',
  'M682 402 C674 410 668 418 664 428',
  'M682 402 C694 404 704 410 712 418',
  'M746 386 C758 390 768 396 776 406',
  'M766 246 C776 254 782 264 786 276',
  'M782 204 C796 202 808 206 818 214',
  'M408 34 C400 24 394 14 392 4',
  'M408 34 C398 38 390 40 380 38',
  'M438 24 C438 12 434 2 428 -8',
  'M262 552 C252 560 244 570 238 582',
  'M252 496 C240 494 230 488 222 480',
  'M606 650 C608 664 606 676 602 688',
  'M560 642 C548 650 538 660 530 672',
  'M282 380 C270 386 260 396 252 408',
  'M276 342 C264 340 252 344 242 352',
  'M656 216 C666 206 674 194 678 180',
  'M664 284 C676 292 686 302 694 314',
  'M704 516 C714 526 722 538 728 552',
  'M646 522 C636 532 626 542 614 548',
  'M336 448 C330 438 326 430 326 420',
  'M444 370 C452 362 462 356 474 352',
  'M706 368 C716 358 728 352 742 350',
  'M596 604 C586 610 578 616 572 626',
  'M318 356 C312 366 306 374 296 382',
  'M628 254 C620 264 612 274 602 280',
  'M674 486 C684 480 696 478 708 482',
  'M572 542 C560 544 548 548 538 556',
];

const ultraFineSeeds = [
  { x: 300, y: 406, dx: -12, dy: -15 },
  { x: 290, y: 428, dx: -16, dy: -4 },
  { x: 282, y: 480, dx: -13, dy: 12 },
  { x: 396, y: 410, dx: -16, dy: 10 },
  { x: 398, y: 378, dx: -18, dy: -10 },
  { x: 502, y: 424, dx: 12, dy: 16 },
  { x: 664, y: 428, dx: -7, dy: 19 },
  { x: 712, y: 418, dx: 16, dy: 8 },
  { x: 776, y: 406, dx: 14, dy: 12 },
  { x: 786, y: 276, dx: 6, dy: 18 },
  { x: 818, y: 214, dx: 17, dy: 8 },
  { x: 392, y: 4, dx: -4, dy: -18 },
  { x: 380, y: 38, dx: -18, dy: 0 },
  { x: 428, y: -8, dx: -10, dy: -18 },
  { x: 238, y: 582, dx: -10, dy: 16 },
  { x: 222, y: 480, dx: -16, dy: -8 },
  { x: 602, y: 688, dx: 2, dy: 18 },
  { x: 530, y: 672, dx: -12, dy: 14 },
  { x: 252, y: 408, dx: -11, dy: 14 },
  { x: 242, y: 352, dx: -15, dy: 6 },
  { x: 678, y: 180, dx: 8, dy: -18 },
  { x: 694, y: 314, dx: 16, dy: 12 },
  { x: 728, y: 552, dx: 10, dy: 18 },
  { x: 614, y: 548, dx: -17, dy: 8 },
  { x: 326, y: 420, dx: -7, dy: -19 },
  { x: 474, y: 352, dx: 17, dy: -10 },
  { x: 742, y: 350, dx: 18, dy: -4 },
  { x: 572, y: 626, dx: -7, dy: 16 },
  { x: 296, y: 382, dx: -13, dy: 10 },
  { x: 602, y: 280, dx: -14, dy: 10 },
  { x: 708, y: 482, dx: 18, dy: 2 },
  { x: 538, y: 556, dx: -17, dy: 10 },
];

const ultraNanoBranches = ultraFineSeeds.flatMap((seed, seedIndex) =>
  Array.from({ length: 10 }, (_, branchIndex) => {
    const side = branchIndex % 2 === 0 ? 1 : -1;
    const spread = (branchIndex - 4.5) * 0.58;
    const curl = Math.sin(seedIndex * 1.7 + branchIndex * 0.9) * 2.2;
    const startX = seed.x + side * spread + Math.cos(branchIndex) * 1.2;
    const startY = seed.y - branchIndex * 0.42 + Math.sin(seedIndex) * 0.9;
    const endX = startX + seed.dx * (0.76 + branchIndex * 0.018) + side * curl;
    const endY = startY + seed.dy * (0.72 + (branchIndex % 4) * 0.035) - Math.abs(spread) * 0.28;
    const controlX1 = startX + seed.dx * 0.24 + side * (1.8 + (branchIndex % 3) * 0.6);
    const controlY1 = startY + seed.dy * 0.18 - 1.4;
    const controlX2 = startX + seed.dx * 0.58 - side * (1.2 + (seedIndex % 4) * 0.45);
    const controlY2 = startY + seed.dy * 0.52 + curl * 0.35;

    return `M${startX.toFixed(1)} ${startY.toFixed(1)} C${controlX1.toFixed(1)} ${controlY1.toFixed(1)} ${controlX2.toFixed(1)} ${controlY2.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
  }),
);

const expandedNeuralThreads = Array.from({ length: 400 }, (_, index) => {
  const band = index % 40;
  const layer = Math.floor(index / 40);
  const phase = index * 0.618;
  const arc = (band - 19.5) / 19.5;
  const centerX = 502 + Math.sin(layer * 0.86) * 38 + arc * 58;
  const centerY = 186 + layer * 39 + Math.cos(band * 0.42) * 18;
  const length = 26 + (index % 9) * 3.2;
  const tilt = -38 + layer * 6.5 + Math.sin(phase) * 16;
  const curl = Math.cos(phase * 1.3) * 9;
  const startX = centerX - Math.cos((tilt * Math.PI) / 180) * length * 0.46;
  const startY = centerY - Math.sin((tilt * Math.PI) / 180) * length * 0.32;
  const endX = centerX + Math.cos((tilt * Math.PI) / 180) * length * 0.54;
  const endY = centerY + Math.sin((tilt * Math.PI) / 180) * length * 0.36;
  const controlX1 = startX + Math.sin(phase) * 7 + curl * 0.35;
  const controlY1 = startY - 8 + Math.cos(phase * 0.7) * 5;
  const controlX2 = endX - Math.cos(phase) * 8 - curl * 0.25;
  const controlY2 = endY + 7 + Math.sin(phase * 0.9) * 5;

  return `M${startX.toFixed(1)} ${startY.toFixed(1)} C${controlX1.toFixed(1)} ${controlY1.toFixed(1)} ${controlX2.toFixed(1)} ${controlY2.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
});

const surfaceWeaveThreads = Array.from({ length: 1280 }, (_, index) => {
  const column = index % 80;
  const row = Math.floor(index / 80);
  const u = column / 79;
  const v = row / 15;
  const phase = index * 0.437;
  const bottleWidth = 150 + Math.sin(v * Math.PI) * 108 - Math.abs(v - 0.48) * 38;
  const neckPull = v < 0.34 ? (0.34 - v) * 118 : 0;
  const centerX = 506 + Math.sin(v * Math.PI * 1.25 - 0.7) * 35 + neckPull;
  const centerY = 124 + v * 485 + Math.sin(u * Math.PI * 2.4) * 8;
  const x = centerX + (u - 0.5) * bottleWidth + Math.sin(phase) * 9;
  const y = centerY + Math.cos(phase * 1.2) * 10;
  const direction = (index + row) % 3;
  const length = 18 + (index % 11) * 2.1 + Math.sin(v * Math.PI) * 14;
  const tilt =
    direction === 0 ? -22 + v * 44 : direction === 1 ? 24 - v * 30 : 88 + Math.sin(phase) * 16;
  const angle = (tilt * Math.PI) / 180;
  const startX = x - Math.cos(angle) * length * 0.5;
  const startY = y - Math.sin(angle) * length * 0.42;
  const endX = x + Math.cos(angle) * length * 0.5;
  const endY = y + Math.sin(angle) * length * 0.42;
  const bend = Math.sin(phase * 1.7) * 7;
  const controlX1 = startX + Math.cos(angle + 0.9) * length * 0.25 + bend * 0.4;
  const controlY1 = startY + Math.sin(angle + 0.9) * length * 0.18;
  const controlX2 = endX - Math.cos(angle - 0.8) * length * 0.25 - bend * 0.35;
  const controlY2 = endY - Math.sin(angle - 0.8) * length * 0.18;

  return `M${startX.toFixed(1)} ${startY.toFixed(1)} C${controlX1.toFixed(1)} ${controlY1.toFixed(1)} ${controlX2.toFixed(1)} ${controlY2.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
});

const synapsePoints = [
  { cx: 596, cy: 374, r: 1.7 },
  { cx: 496, cy: 468, r: 1.5 },
  { cx: 382, cy: 386, r: 1.2 },
  { cx: 548, cy: 404, r: 1.4 },
  { cx: 542, cy: 240, r: 1.3 },
  { cx: 668, cy: 338, r: 1.1 },
  { cx: 572, cy: 542, r: 1.2 },
  { cx: 466, cy: 216, r: 1.1 },
  { cx: 326, cy: 478, r: 1.1 },
  { cx: 690, cy: 210, r: 1.2 },
  { cx: 374, cy: 344, r: 1 },
  { cx: 674, cy: 486, r: 1.1 },
];

export const KleinBottleFoldSpace: React.FC<KleinBottleFoldSpaceProps> = ({
  compact = false,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const bloomClipId = `klein-branch-bloom-clip-${uid}`;
  const bottleGradientId = `klein-branch-bottle-${uid}`;
  const nebulaGradientId = `klein-cosmic-nebula-${uid}`;
  const depthGradientId = `klein-cosmic-depth-${uid}`;
  const nerveGradientId = `klein-branch-nerve-${uid}`;
  const nerveCoreGradientId = `klein-branch-nerve-core-${uid}`;
  const branchGlowId = `klein-branch-glow-${uid}`;
  const nerveBloomId = `klein-branch-nerve-bloom-${uid}`;
  const softBloomId = `klein-soft-bloom-${uid}`;
  const visualFrame = compact
    ? 'left-1/2 top-1/2 h-[132%] w-[132%] -translate-x-1/2 -translate-y-1/2 scale-[0.86] max-sm:h-[150%] max-sm:w-[150%] max-sm:scale-[0.72]'
    : 'left-1/2 top-1/2 h-[min(90vh,860px)] w-[min(96vw,1180px)] -translate-x-1/2 -translate-y-1/2 scale-[0.98] max-sm:h-[72vh] max-sm:w-[112vw] max-sm:scale-[0.9]';

  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-[#020715] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_46%_38%,rgba(88,28,135,0.2),transparent_30%),radial-gradient(circle_at_56%_52%,rgba(8,145,178,0.3),rgba(15,23,42,0.78)_43%,rgba(0,0,0,0.97)_86%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(12,32,78,0.58),rgba(17,24,72,0.86)_46%,rgba(4,3,18,0.98))]" />
      <div className="absolute inset-[0.85rem] border border-cyan-100/22 shadow-[inset_0_0_42px_rgba(56,189,248,0.16),0_0_42px_rgba(37,99,235,0.1)] max-sm:inset-2" />
      <div className="absolute inset-[1.45rem] border border-violet-200/10 shadow-[inset_0_0_52px_rgba(88,28,135,0.12)] max-sm:inset-4" />
      <div className="absolute left-[0.85rem] top-[0.85rem] h-10 w-10 border-l border-t border-cyan-200/52 max-sm:left-2 max-sm:top-2" />
      <div className="absolute right-[0.85rem] top-[0.85rem] h-10 w-10 border-r border-t border-cyan-200/38 max-sm:right-2 max-sm:top-2" />
      <div className="absolute bottom-[0.85rem] left-[0.85rem] h-10 w-10 border-b border-l border-violet-200/34 max-sm:bottom-2 max-sm:left-2" />
      <div className="absolute bottom-[0.85rem] right-[0.85rem] h-10 w-10 border-b border-r border-cyan-200/44 max-sm:bottom-2 max-sm:right-2" />

      <motion.div
        className="absolute left-1/2 top-1/2 h-[78vmin] w-[78vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/14 blur-3xl"
        animate={{ opacity: [0.38, 0.58, 0.42], scale: [0.98, 1.05, 0.99] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.svg
        viewBox="0 0 1000 720"
        preserveAspectRatio="xMidYMid meet"
        className={`absolute ${visualFrame}`}
        animate={{ opacity: [0.98, 1, 0.99] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          <clipPath id={bloomClipId}>
            <path d={kleinOuterPath} />
          </clipPath>
          <radialGradient id={bottleGradientId} cx="48%" cy="54%" r="62%">
            <stop offset="0%" stopColor="rgba(125,211,252,0.38)" />
            <stop offset="32%" stopColor="rgba(37,99,235,0.3)" />
            <stop offset="64%" stopColor="rgba(88,28,135,0.24)" />
            <stop offset="100%" stopColor="rgba(1,4,20,0.2)" />
          </radialGradient>
          <radialGradient id={nebulaGradientId} cx="40%" cy="36%" r="54%">
            <stop offset="0%" stopColor="rgba(167,139,250,0.42)" />
            <stop offset="34%" stopColor="rgba(96,165,250,0.24)" />
            <stop offset="68%" stopColor="rgba(34,211,238,0.12)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0)" />
          </radialGradient>
          <radialGradient id={depthGradientId} cx="64%" cy="66%" r="62%">
            <stop offset="0%" stopColor="rgba(4,6,34,0.82)" />
            <stop offset="42%" stopColor="rgba(30,27,75,0.42)" />
            <stop offset="74%" stopColor="rgba(12,74,110,0.18)" />
            <stop offset="100%" stopColor="rgba(14,165,233,0)" />
          </radialGradient>
          <linearGradient id={nerveGradientId} x1="280" y1="610" x2="690" y2="112">
            <stop offset="0%" stopColor="rgba(20,184,166,0.28)" />
            <stop offset="30%" stopColor="rgba(34,211,238,0.78)" />
            <stop offset="58%" stopColor="rgba(96,165,250,0.72)" />
            <stop offset="82%" stopColor="rgba(167,139,250,0.7)" />
            <stop offset="100%" stopColor="rgba(216,180,254,0.56)" />
          </linearGradient>
          <linearGradient id={nerveCoreGradientId} x1="292" y1="600" x2="690" y2="130">
            <stop offset="0%" stopColor="rgba(34,211,238,0)" />
            <stop offset="42%" stopColor="rgba(240,249,255,0.92)" />
            <stop offset="62%" stopColor="rgba(165,243,252,0.86)" />
            <stop offset="82%" stopColor="rgba(196,181,253,0.62)" />
            <stop offset="100%" stopColor="rgba(216,180,254,0.32)" />
          </linearGradient>
          <filter id={branchGlowId} x="-28%" y="-28%" width="156%" height="156%">
            <feGaussianBlur stdDeviation="0.42" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={nerveBloomId} x="-65%" y="-65%" width="230%" height="230%">
            <feGaussianBlur stdDeviation="0.85" result="soft" />
            <feGaussianBlur stdDeviation="2.4" result="wide" />
            <feMerge>
              <feMergeNode in="wide" />
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={softBloomId} x="-18%" y="-18%" width="136%" height="136%">
            <feGaussianBlur stdDeviation="7" result="soft" />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g clipPath={`url(#${bloomClipId})`}>
          <path d={kleinOuterPath} fill={`url(#${bottleGradientId})`} opacity="0.66" />
          <path d={kleinOuterPath} fill={`url(#${depthGradientId})`} opacity="0.86" />
          <motion.path
            d={kleinOuterPath}
            fill={`url(#${nebulaGradientId})`}
            opacity="0.62"
            filter={`url(#${softBloomId})`}
            animate={{ opacity: [0.34, 0.58, 0.4] }}
            transition={{ duration: 9.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <path d={kleinBodyPath} fill="rgba(3,20,50,0.34)" opacity="0.9" />

          {internalDepthPaths.map((d, index) => (
            <path
              key={`internal-depth-${index}`}
              d={d}
              fill="none"
              stroke={index === 0 ? 'rgba(2,6,23,0.64)' : 'rgba(15,23,42,0.44)'}
              strokeWidth={index === 0 ? 26 : 18}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.72"
            />
          ))}
          {internalDepthPaths.map((d, index) => (
            <motion.path
              key={`internal-depth-rim-${index}`}
              d={d}
              fill="none"
              stroke={index === 0 ? 'rgba(96,165,250,0.24)' : 'rgba(167,139,250,0.16)'}
              strokeWidth={0.075}
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ opacity: [0.24, 0.56, 0.3] }}
              transition={{
                duration: 6.4 + index * 0.9,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}

          <motion.g
            filter={`url(#${nerveBloomId})`}
            style={{ mixBlendMode: 'screen' }}
            strokeDasharray="2.8 9.2"
            animate={{ opacity: [0.34, 0.58, 0.4], strokeDashoffset: [0, -28] }}
            transition={{
              opacity: { duration: 6.8, repeat: Infinity, ease: 'easeInOut' },
              strokeDashoffset: { duration: 8.5, repeat: Infinity, ease: 'linear' },
            }}
          >
            {trunkBranches.map((branch) => (
              <path
                key={`trunk-halo-${branch.key}`}
                d={branch.d}
                fill="none"
                stroke={branch.width > 12 ? 'rgba(126,239,255,0.2)' : 'rgba(216,180,254,0.16)'}
                strokeWidth={0.1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {fineBranches.map((d, index) => (
              <path
                key={`fine-halo-${index}`}
                d={d}
                fill="none"
                stroke={index % 3 === 0 ? 'rgba(216,180,254,0.16)' : 'rgba(126,239,255,0.16)'}
                strokeWidth={0.075}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </motion.g>

          <motion.g
            filter={`url(#${branchGlowId})`}
            strokeDasharray="2.2 7.4"
            style={{ mixBlendMode: 'screen' }}
            animate={{ strokeDashoffset: [0, -34] }}
            transition={{ duration: 7.6, repeat: Infinity, ease: 'linear' }}
          >
            {structuralFlowPaths.map((d, index) => (
              <motion.path
                key={`structural-flow-${index}`}
                d={d}
                fill="none"
                stroke={
                  index % 2 === 0
                    ? 'rgba(191,219,254,0.62)'
                    : index % 3 === 0
                      ? 'rgba(167,139,250,0.5)'
                      : 'rgba(103,232,249,0.54)'
                }
                strokeWidth={0.1}
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ opacity: [0.3, 0.78, 0.42] }}
                transition={{
                  duration: 5.8 + index * 0.35,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {trunkBranches.map((branch) => (
              <path
                key={branch.key}
                d={branch.d}
                fill="none"
                stroke={`url(#${nerveGradientId})`}
                strokeWidth={0.1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {trunkBranches.map((branch) => (
              <motion.path
                key={`inner-${branch.key}`}
                d={branch.d}
                fill="none"
                stroke={`url(#${nerveCoreGradientId})`}
                strokeWidth={0.075}
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ opacity: [0.38, 0.95, 0.48] }}
                transition={{
                  duration: 4.8 + branch.width * 0.08,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {fineBranches.map((d, index) => (
              <path
                key={`fine-${index}`}
                d={d}
                fill="none"
                stroke={
                  index % 4 === 0
                    ? 'rgba(196,181,253,0.62)'
                    : index % 3 === 0
                      ? 'rgba(147,197,253,0.58)'
                      : 'rgba(126,239,255,0.58)'
                }
                strokeWidth={index % 5 === 0 ? 0.075 : 0.065}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {branchTips.map((d, index) => (
              <motion.path
                key={`tip-${index}`}
                d={d}
                fill="none"
                stroke={index % 2 === 0 ? 'rgba(186,230,253,0.72)' : 'rgba(196,181,253,0.6)'}
                strokeWidth={0.06}
                strokeLinecap="round"
                animate={{ opacity: [0.24, 0.86, 0.34] }}
                transition={{
                  duration: 3.6 + index * 0.18,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {microBranches.map((d, index) => (
              <motion.path
                key={`micro-${index}`}
                d={d}
                fill="none"
                stroke={
                  index % 5 === 0
                    ? 'rgba(167,139,250,0.5)'
                    : index % 3 === 0
                      ? 'rgba(147,197,253,0.5)'
                      : 'rgba(186,230,253,0.52)'
                }
                strokeWidth={0.055}
                strokeLinecap="round"
                animate={{ opacity: [0.16, 0.72, 0.22] }}
                transition={{
                  duration: 3.2 + (index % 7) * 0.18,
                  delay: index * 0.05,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {nanoBranches.map((d, index) => (
              <motion.path
                key={`nano-${index}`}
                d={d}
                fill="none"
                stroke={index % 4 === 0 ? 'rgba(196,181,253,0.36)' : 'rgba(224,242,254,0.42)'}
                strokeWidth={0.05}
                strokeLinecap="round"
                animate={{ opacity: [0.08, 0.48, 0.14] }}
                transition={{
                  duration: 3.4 + (index % 9) * 0.12,
                  delay: index * 0.035,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {expandedNeuralThreads.map((d, index) => (
              <motion.path
                key={`expanded-thread-${index}`}
                d={d}
                fill="none"
                stroke={
                  index % 11 === 0
                    ? 'rgba(196,181,253,0.3)'
                    : index % 7 === 0
                      ? 'rgba(147,197,253,0.34)'
                      : 'rgba(56,189,248,0.3)'
                }
                strokeWidth={index % 6 === 0 ? 0.075 : 0.05}
                strokeLinecap="round"
                animate={{ opacity: [0.04, 0.24, 0.07] }}
                transition={{
                  duration: 3.2 + (index % 17) * 0.06,
                  delay: (index % 120) * 0.012,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {surfaceWeaveThreads.map((d, index) => (
              <motion.path
                key={`surface-weave-${index}`}
                d={d}
                fill="none"
                stroke={
                  index % 13 === 0
                    ? 'rgba(167,139,250,0.28)'
                    : index % 8 === 0
                      ? 'rgba(191,219,254,0.3)'
                      : index % 5 === 0
                        ? 'rgba(96,165,250,0.26)'
                        : 'rgba(34,211,238,0.24)'
                }
                strokeWidth={index % 7 === 0 ? 0.075 : 0.05}
                strokeLinecap="round"
                animate={{ opacity: [0.035, 0.2, 0.06] }}
                transition={{
                  duration: 3.6 + (index % 19) * 0.05,
                  delay: (index % 160) * 0.01,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {ultraNanoBranches.map((d, index) => (
              <motion.path
                key={`ultra-nano-glow-${index}`}
                d={d}
                fill="none"
                stroke={index % 5 === 0 ? 'rgba(196,181,253,0.3)' : 'rgba(125,211,252,0.3)'}
                strokeWidth={0.075}
                strokeLinecap="round"
                animate={{ opacity: [0.06, 0.3, 0.09] }}
                transition={{
                  duration: 2.8 + (index % 13) * 0.07,
                  delay: (index % 80) * 0.018,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {ultraNanoBranches.map((d, index) => (
              <motion.path
                key={`ultra-nano-${index}`}
                d={d}
                fill="none"
                stroke={index % 5 === 0 ? 'rgba(221,214,254,0.52)' : 'rgba(224,242,254,0.62)'}
                strokeWidth={0.05}
                strokeLinecap="round"
                animate={{ opacity: [0.12, 0.68, 0.18] }}
                transition={{
                  duration: 2.8 + (index % 13) * 0.07,
                  delay: (index % 80) * 0.018,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
            {synapsePoints.map((point, index) => (
              <motion.circle
                key={`synapse-${index}`}
                cx={point.cx}
                cy={point.cy}
                r={point.r * 0.58}
                fill={index % 4 === 0 ? 'rgba(216,180,254,0.72)' : 'rgba(224,242,254,0.82)'}
                animate={{ opacity: [0.2, 0.84, 0.3], scale: [0.75, 1.34, 0.9] }}
                transition={{
                  duration: 2.6 + (index % 5) * 0.2,
                  delay: index * 0.08,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.g>
        </g>

        <motion.path
          d={kleinBodyPath}
          fill="none"
          stroke="rgba(224,242,254,0.64)"
          strokeWidth="0.16"
          strokeLinecap="round"
          filter={`url(#${branchGlowId})`}
          animate={{ opacity: [0.5, 0.82, 0.58] }}
          transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d={kleinOuterPath}
          fill="none"
          stroke="rgba(125,211,252,0.5)"
          strokeWidth="0.14"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${branchGlowId})`}
          animate={{ opacity: [0.38, 0.68, 0.46] }}
          transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <path
          d="M435 448 C478 414 556 392 616 416 C656 432 654 480 606 515 C558 551 474 554 418 522 C365 492 365 462 435 448 Z"
          fill="rgba(1,6,18,0.62)"
          stroke="rgba(96,165,250,0.28)"
          strokeWidth="0.12"
        />
        <path
          d={kleinReturnPath}
          fill="none"
          stroke="rgba(240,249,255,0.68)"
          strokeWidth="0.14"
          strokeLinecap="round"
        />
      </motion.svg>
    </div>
  );
};

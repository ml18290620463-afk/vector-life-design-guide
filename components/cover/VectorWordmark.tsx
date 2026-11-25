import { useId } from 'react';

/** Optically balanced contours: lighter stems, open counters, and the signature split E. */
export function VectorWordmark() {
  const silkId = useId();
  return (
    <svg viewBox="0 0 654 112" role="img" aria-label="VECTOR" fill="currentColor">
      <defs>
        <linearGradient id={`${silkId}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#abc6da" />
          <stop offset="0.36" stopColor="#c4d9e7" />
          <stop offset="0.58" stopColor="#9fbfd5" />
          <stop offset="1" stopColor="#88acc5" />
        </linearGradient>
        <linearGradient id={`${silkId}-light`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${silkId}-clip`}>
          <rect x="126" y="46" width="34" height="18" rx="9" />
        </clipPath>
      </defs>
      <path d="M2 1H19Q22 1 23 4L56 88 89 4Q90 1 94 1H110L69 106Q68 109 64 109H48Q44 109 43 106Z" />
      <rect x="126" y="1" width="75" height="18" rx="9" />
      <g clipPath={`url(#${silkId}-clip)`}>
        <rect x="126" y="46" width="34" height="18" rx="9" fill={`url(#${silkId}-body)`} />
        <path
          d="M125 58C136 47 148 58 162 48"
          fill="none"
          stroke={`url(#${silkId}-light)`}
          strokeWidth="1.1"
        />
        <path
          d="M127 61C140 53 149 62 162 53"
          fill="none"
          stroke="#f4f9fc"
          strokeOpacity="0.24"
          strokeWidth="0.6"
        />
        <path
          d="M128 59C138 56 150 61 159 54"
          fill="none"
          stroke="#547f9e"
          strokeOpacity="0.2"
          strokeWidth="0.65"
        />
      </g>
      <rect x="126" y="91" width="75" height="18" rx="9" />
      <path d="M316 34L298 37C293 25 283 18 270 18C248 18 234 34 234 56S248 93 270 93C283 93 293 86 298 74L316 77C310 98 294 111 270 111C238 111 215 88 215 56S238 0 270 0C293 0 310 13 316 34Z" />
      <path d="M332 1H415V19H383V109H365V19H332Z" />
      <path
        fillRule="evenodd"
        d="M481 0C513 0 536 24 536 56S513 111 481 111S427 88 427 56S449 0 481 0ZM481 18C459 18 445 34 445 56S459 93 481 93S518 78 518 56S503 18 481 18Z"
      />
      <path
        fillRule="evenodd"
        d="M555 1H593C619 1 634 14 634 35C634 51 626 62 612 67L653 109H628L590 70H573V109H555ZM573 19V52H592C608 52 616 46 616 35S608 19 592 19Z"
      />
    </svg>
  );
}

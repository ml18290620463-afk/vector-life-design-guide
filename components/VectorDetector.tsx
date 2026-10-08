import React, { useId } from 'react';
import './VectorDetector.css';

/** Shared, resolution-independent cover instrument. */
export function VectorDetector() {
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => `url(#${id}-${name})`;
  const chip = 'M-39-48H39L48-39V39L39 48H-39L-48 39V-39Z';
  // The outer halo remains evenly distributed; the chip signals deliberately do not.
  const quadrants = [-10, 80, 170, 260];
  const chipSignals = [
    // These begin precisely at the existing chip traces, then grow outward like a quiet circuit canopy.
    {
      d: 'M300 209 C302 186 294 174 303 154 C313 132 311 111 302 92 C294 73 300 54 316 38',
      delay: 0,
    },
    { d: 'M303 154 C284 145 271 131 267 112 C264 96 253 84 234 77', delay: -3.1, branch: true },
    { d: 'M391 300 C414 293 421 267 445 249 C465 234 483 233 504 222', delay: -5.4 },
    { d: 'M445 249 C451 267 466 278 484 281 C502 285 514 295 527 308', delay: -8.2, branch: true },
    { d: 'M325 391 C335 414 349 426 358 448 C366 468 382 481 400 495', delay: -10.4 },
    { d: 'M358 448 C340 454 326 464 317 481 C308 496 294 505 278 513', delay: -12.8, branch: true },
    {
      d: 'M209 325 C229 338 224 352 204 359 C184 367 171 382 154 395 C138 408 119 411 103 422',
      delay: -15.5,
    },
    { d: 'M204 359 C211 341 207 324 195 309 C185 296 181 280 181 264', delay: -18.1, branch: true },
  ];
  return (
    <svg className="vector-detector" viewBox="0 0 600 600" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={`${id}-metal`}
          x1="130"
          y1="90"
          x2="450"
          y2="520"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#829da5" />
          <stop offset=".18" stopColor="#e2efeb" />
          <stop offset=".38" stopColor="#a4bfc0" />
          <stop offset=".65" stopColor="#344e59" />
          <stop offset=".85" stopColor="#869fa7" />
          <stop offset="1" stopColor="#243c46" />
        </linearGradient>
        <linearGradient
          id={`${id}-chip`}
          x1="-55"
          y1="-55"
          x2="55"
          y2="55"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e4f0ed" />
          <stop offset=".3" stopColor="#a6c3c2" />
          <stop offset=".55" stopColor="#354f5c" />
          <stop offset="1" stopColor="#10212b" />
        </linearGradient>
        <radialGradient id={`${id}-face`}>
          <stop stopColor="#3e6065" />
          <stop offset=".55" stopColor="#223b44" />
          <stop offset="1" stopColor="#132831" stopOpacity=".7" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="#c6e8df" stopOpacity=".38" />
          <stop offset="1" stopColor="#a0ceca" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.2" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-soft`}>
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <mask
          id={`${id}-outer-flow`}
          maskUnits="userSpaceOnUse"
          x="-10"
          y="-10"
          width="620"
          height="620"
        >
          {quadrants.map((angle, i) => (
            <circle
              key={angle}
              className="detector-outer-signal"
              cx="300"
              cy="300"
              r="292"
              pathLength="100"
              stroke="white"
              strokeWidth="10"
              transform={`rotate(${angle - 90} 300 300)`}
              style={{ animationDelay: `${-i * 3}s` }}
            />
          ))}
        </mask>
      </defs>
      <circle
        cx="300"
        cy="300"
        r="286"
        fill={ref('face')}
        fillOpacity=".14"
        stroke="#91bfd1"
        strokeOpacity=".08"
      />
      <circle
        className="detector-dotted-halo"
        cx="300"
        cy="300"
        r="292"
        pathLength="120"
        stroke="#a9d5e3"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0 1"
        opacity=".38"
      />
      <g mask={ref('outer-flow')}>
        <circle cx="300" cy="300" r="292" stroke="#b6eaff" strokeWidth="1" opacity=".5" />
        <circle
          cx="300"
          cy="300"
          r="292"
          pathLength="120"
          stroke="#d9faff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="0 1"
          filter={ref('glow')}
        />
      </g>
      <circle
        cx="300"
        cy="300"
        r="255"
        stroke="#81bbce"
        strokeWidth="2"
        strokeDasharray="2 26"
        opacity=".2"
      />
      <circle cx="300" cy="300" r="237" stroke="#0a202e" strokeWidth="7" opacity=".35" />
      <circle cx="300" cy="300" r="234" stroke="#88b5c5" strokeOpacity=".35" strokeWidth="2" />
      <g className="detector-neural-web" strokeLinecap="round" strokeLinejoin="round">
        {chipSignals.map(({ d, delay, branch }) => (
          <g key={d}>
            <path
              d={d}
              stroke="#adcfce"
              strokeWidth={branch ? '.4' : '.56'}
              opacity={branch ? '.12' : '.17'}
            />
            <path
              className={`detector-neural-signal${branch ? ' detector-neural-branch' : ''}`}
              d={d}
              pathLength="100"
              stroke={branch ? '#d5e5e2' : '#d7eee8'}
              strokeWidth={branch ? '.62' : '.9'}
              filter={ref('glow')}
              style={{ animationDelay: `${delay}s` }}
            />
          </g>
        ))}
      </g>
      <g className="detector-metal-turn">
        <circle cx="300" cy="300" r="218" stroke={ref('metal')} strokeWidth="4.5" opacity=".72" />
        {[215, 221].map((r) => (
          <circle
            key={r}
            cx="300"
            cy="300"
            r={r}
            stroke="#d5edf4"
            strokeWidth=".7"
            opacity=".22"
            strokeDasharray="240 35 140 85 360 520"
          />
        ))}
        {[24, 144, 264].map((angle) => (
          <path
            key={angle}
            d="M300 70V95"
            stroke="#0d293b"
            strokeWidth="2"
            opacity=".65"
            transform={`rotate(${angle} 300 300)`}
          />
        ))}
      </g>
      {[203, 240].map((r) => (
        <circle
          key={r}
          cx="300"
          cy="300"
          r={r}
          stroke={ref('metal')}
          strokeWidth={r === 203 ? 1.8 : 1}
          opacity=".32"
        />
      ))}
      <g className="detector-outer-turn">
        <circle
          cx="300"
          cy="300"
          r="246"
          stroke="#9ed5e4"
          strokeOpacity=".24"
          strokeWidth="3"
          pathLength="120"
          strokeDasharray="18 12"
        />
        <circle
          cx="300"
          cy="300"
          r="246"
          stroke="#cef7ff"
          strokeWidth="1.5"
          strokeLinecap="round"
          pathLength="120"
          strokeDasharray="4 56"
          opacity=".7"
        />
      </g>
      <g className="detector-middle-turn">
        <circle cx="300" cy="300" r="190" stroke={ref('metal')} strokeWidth="3" opacity=".7" />
        <circle cx="300" cy="300" r="182" stroke="#0b2638" strokeWidth="3" opacity=".3" />
        <g opacity=".62">
          {Array.from({ length: 72 }, (_, i) => (
            <line
              key={i}
              x1="300"
              y1="126"
              x2="300"
              y2={i % 6 === 0 ? 141 : i % 3 === 0 ? 136 : 131}
              stroke="#a8cddf"
              strokeWidth={i % 6 === 0 ? 1.7 : 1}
              transform={`rotate(${i * 5} 300 300)`}
            />
          ))}
        </g>
      </g>
      <g className="detector-inner-turn">
        <circle
          cx="300"
          cy="300"
          r="143"
          stroke="#b1d7d3"
          strokeWidth="7"
          opacity=".10"
          filter={ref('soft')}
        />
        <circle cx="300" cy="300" r="145" stroke="#719aaf" strokeWidth="3" opacity=".3" />
        <circle cx="300" cy="300" r="140" stroke="#c1ddd7" strokeWidth="2" filter={ref('glow')} />
        <circle
          className="detector-neural-ring"
          cx="300"
          cy="300"
          r="140"
          pathLength="100"
          stroke="#edf7ff"
          strokeWidth="1.6"
          strokeLinecap="round"
          filter={ref('glow')}
        />
        <circle cx="300" cy="300" r="128" stroke="#6ba0b9" strokeWidth="2" opacity=".5" />
        <circle
          cx="300"
          cy="300"
          r="118"
          stroke="#a9d6e5"
          strokeWidth="2"
          pathLength="120"
          strokeDasharray="24 6"
          opacity=".5"
        />
      </g>
      <circle cx="300" cy="300" r="103" stroke="#95cad8" strokeWidth="3" opacity=".6" />
      <circle cx="300" cy="300" r="96" stroke="#abc7c8" strokeWidth="2" opacity=".6" />
      <g transform="translate(300 300)">
        {[0, 90, 180, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            {[-24, -16, -8, 0, 8, 16, 24].map((x, i) => (
              <path
                key={x}
                d={`M${x} -47 V-${65 + (i % 3) * 5} L${x * 1.55} -${77 + (i % 3) * 5} V-91`}
                stroke="#a0d7e5"
                strokeOpacity={i % 2 ? 0.45 : 0.8}
                strokeWidth="1.4"
              />
            ))}
            <path
              d="M-59-18H-72L-83-29V-56L-58-80H-27V-70H-53L-71-51V-31L-60-23"
              stroke="#8cc6db"
              strokeWidth="2"
              opacity=".45"
            />
            <path d="M-66-12H-88V-53L-58-88H-22" stroke="#93c2d7" strokeWidth="1" opacity=".6" />
          </g>
        ))}
        <path d={chip} transform="scale(1.25)" fill="#122f43" stroke="#bce0e9" strokeWidth="2" />
        <path
          d={chip}
          transform="scale(1.12)"
          fill={ref('chip')}
          stroke="#d0eaf0"
          strokeWidth="2"
        />
        <path d={chip} fill="#183749" stroke="#557e95" strokeWidth="3" />
        <path
          d={chip}
          transform="scale(.85)"
          fill={ref('chip')}
          stroke="#b6dae7"
          strokeWidth="1.5"
        />
        <path d={chip} transform="scale(.71)" fill="#193746" stroke="#6293ab" />
        <g className="detector-chip-light" stroke="#d8f5fa" strokeWidth="3.5">
          <rect x="-18" y="-18" width="36" height="36" rx="5" />
          <rect x="-10" y="-10" width="20" height="20" rx="1.5" />
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              {[-11, 0, 11].map((x) => (
                <path key={x} d={`M${x} -18V-24`} />
              ))}
            </g>
          ))}
        </g>
      </g>
      <g className="detector-orbit">
        <circle cx="431" cy="349" r="7" fill="#dceee7" filter={ref('glow')} />
      </g>
      <g className="detector-star-orbit">
        <g className="detector-beacon" transform="translate(300 56)">
          <circle r="43" fill={ref('halo')} />
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={i}
              d={`M0 -${i % 2 ? 18 : 28}V${i % 2 ? 18 : 28}`}
              transform={`rotate(${i * 22.5})`}
              stroke="#dcfaff"
              strokeWidth={i % 4 === 0 ? 1.7 : 0.8}
              opacity={i % 2 ? 0.45 : 0.8}
            />
          ))}
          <circle r="5" fill="#f0ffff" filter={ref('glow')} />
        </g>
      </g>
      <g className="detector-chip-light" fill="#c4f3ff" filter={ref('glow')}>
        <circle cx="300" cy="211" r="2.5" />
        <circle cx="387" cy="300" r="2.5" />
        <circle cx="300" cy="390" r="2" />
      </g>
    </svg>
  );
}

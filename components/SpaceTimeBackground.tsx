import React from 'react';
import { Theme } from '../types';

interface SpaceTimeBackgroundProps {
  theme?: Theme;
}

export const SpaceTimeBackground: React.FC<SpaceTimeBackgroundProps> = ({ theme = 'dark' }) => {
  const starColor = theme === 'light' ? 'var(--color-vector-cyan-brand)' : 'white';

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-700 ${theme === 'light' ? 'bg-vector-fog-light' : 'bg-vector-night-deep'}`}
    >
      {/* 1. Deep Nebula/Aurora Effects (The Sky) */}
      <div
        className={`absolute top-0 left-0 w-full h-full transition-opacity duration-700 ${theme === 'light' ? 'opacity-30' : 'opacity-40'}`}
      >
        <div
          className={`absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] rounded-full blur-[120px] ${theme === 'light' ? 'bg-cyan-200/20' : 'bg-indigo-950/5'}`}
        ></div>
        <div
          className={`absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] rounded-full blur-[120px] ${theme === 'light' ? 'bg-blue-200/20' : 'bg-cyan-950/5'}`}
        ></div>

        {/* Stars */}
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.08] z-0"
          style={{
            backgroundImage: `radial-gradient(${starColor} 1.5px, transparent 1.5px)`,
            backgroundSize: '80px 80px',
          }}
        ></div>
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.04] z-0"
          style={{
            backgroundImage: `radial-gradient(${starColor} 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '20px 20px',
          }}
        ></div>
      </div>

      {/* 2. THE STAR RIVER GRID (Static) */}
      <div className="absolute inset-0 perspective-[100vh]">
        <div className="absolute inset-[-50%] origin-bottom transform-gpu [transform:rotateX(60deg)_translateZ(0)] opacity-40">
          <div
            className={`w-full h-full bg-[size:100px_100px] ${
              theme === 'light' ? 'bg-spacetime-grid-light' : 'bg-spacetime-grid-dark'
            }`}
          ></div>
        </div>
      </div>

      {/* 3. SIMPLIFIED SINGULARITY (No heavy ripples) */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="relative top-[25%] w-[100vw] h-[100vw] flex items-center justify-center pointer-events-none">
          <div
            className={`absolute w-12 h-12 rounded-full z-30 transition-colors ${theme === 'light' ? 'bg-cyan-600/10' : 'bg-cyan-500/5 shadow-glow-cyan-neon-bright'}`}
          ></div>
        </div>
      </div>

      {/* 4. Horizon Fade (Atmosphere) */}
      <div
        className={`absolute inset-0 h-[70vh] transition-colors duration-700 ${theme === 'light' ? 'bg-gradient-to-b from-vector-fog-light via-vector-fog-light/90 to-transparent' : 'bg-gradient-to-b from-vector-night-deep via-vector-night-deep/90 to-transparent'}`}
      ></div>

      {/* 5. Rising Soul Particles (Static) */}
      <div
        className={`absolute inset-0 flex justify-around overflow-hidden mix-blend-screen transition-opacity duration-700 ${theme === 'light' ? 'opacity-10' : 'opacity-20'}`}
      >
        <div className="w-[1px] h-full bg-gradient-to-t from-transparent via-cyan-500/20 to-transparent"></div>
        <div className="w-[1px] h-full bg-gradient-to-t from-transparent via-indigo-500/10 to-transparent"></div>
        <div className="w-[1px] h-full bg-gradient-to-t from-transparent via-cyan-500/20 to-transparent"></div>
      </div>

      {/* 6. HUD OVERLAY FRAME (Stereoscopic) */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {/* Corner Brackets */}
        <div
          className={`absolute top-10 left-10 w-24 h-24 border-t-2 border-l-2 ${theme === 'light' ? 'border-cyan-200/50' : 'border-cyan-500/10'}`}
        />
        <div
          className={`absolute top-10 right-10 w-24 h-24 border-t-2 border-r-2 ${theme === 'light' ? 'border-cyan-200/50' : 'border-cyan-500/10'}`}
        />
        <div
          className={`absolute bottom-10 left-10 w-24 h-24 border-b-2 border-l-2 ${theme === 'light' ? 'border-cyan-200/50' : 'border-cyan-500/10'}`}
        />
        <div
          className={`absolute bottom-10 right-10 w-24 h-24 border-b-2 border-r-2 ${theme === 'light' ? 'border-cyan-200/50' : 'border-cyan-500/10'}`}
        />

        {/* Side Rails */}
        <div
          className={`absolute top-1/4 bottom-1/4 left-10 w-px ${theme === 'light' ? 'bg-gradient-to-b from-transparent via-cyan-200/40 to-transparent' : 'bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent'}`}
        />
        <div
          className={`absolute top-1/4 bottom-1/4 right-10 w-px ${theme === 'light' ? 'bg-gradient-to-b from-transparent via-cyan-200/40 to-transparent' : 'bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent'}`}
        />

        {/* Top/Bottom Metrics lines */}
        <div
          className={`absolute top-10 left-36 right-36 h-px ${theme === 'light' ? 'bg-cyan-200/20' : 'bg-cyan-500/5'}`}
        />
        <div
          className={`absolute bottom-10 left-36 right-36 h-px ${theme === 'light' ? 'bg-cyan-200/20' : 'bg-cyan-500/5'}`}
        />
      </div>

      <style>{`
        `}</style>
    </div>
  );
};

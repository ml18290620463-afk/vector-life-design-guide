import { useEffect, useRef, useState } from 'react';

const asset = `${import.meta.env.BASE_URL}assets/vector-home/`;

/** Decorative motion only: the page copy and navigation remain real HTML. */
export function SilkVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (motion.matches || document.hidden) {
        video.pause();
        return;
      }
      if (!video.getAttribute('src')) video.src = `${asset}silk-final.mp4`;
      void video.play().catch(() => setPlaying(false));
    };
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      video.pause();
    };
  }, []);

  return (
    <div className="vector-silk-video" data-playing={playing} aria-hidden="true">
      <img src={`${asset}silk-final-poster.webp`} alt="" fetchPriority="high" />
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster={`${asset}silk-final-poster.webp`}
        onPlaying={() => setPlaying(true)}
        onError={() => setPlaying(false)}
      />
    </div>
  );
}

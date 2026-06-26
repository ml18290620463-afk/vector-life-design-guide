import React, { useState, useEffect } from 'react';

interface DecryptionTextProps {
  text: string;
  speed?: number;
  revealSpeed?: number;
  className?: string;
  startDelay?: number;
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&^*()_+-=[]{}|;:,.<>/?';

export const DecryptionText: React.FC<DecryptionTextProps> = ({
  text,
  speed = 30,
  revealSpeed = 2,
  className = '',
  startDelay = 0,
}) => {
  const [displayText, setDisplayText] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    let iteration = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;

    const startAnimation = () => {
      timer = setInterval(() => {
        setDisplayText((prev) => {
          return text
            .split('')
            .map((letter, index) => {
              if (index < iteration) {
                return text[index];
              }
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join('');
        });

        if (iteration >= text.length) {
          if (timer) clearInterval(timer);
          setIsDone(true);
        }

        iteration += 1 / revealSpeed;
      }, speed);
    };

    if (startDelay > 0) {
      delayTimer = setTimeout(startAnimation, startDelay);
    } else {
      startAnimation();
    }

    return () => {
      if (timer) clearInterval(timer);
      if (delayTimer) clearTimeout(delayTimer);
    };
  }, [text, speed, revealSpeed, startDelay]);

  return <span className={className}>{displayText}</span>;
};

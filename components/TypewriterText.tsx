import React, { useEffect, useState } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
}

/**
 * Reveals `text` one character at a time. Extracted from Viewer.tsx so other
 * places can reuse it without dragging in the entire viewer module.
 */
export const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 30, className }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, index + 1));
      index++;
      if (index >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <div className={`whitespace-pre-wrap ${className ?? ''}`}>{displayedText}</div>;
};

import type { FC, ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useMotionPreference } from '../hooks/useMotionPreference';

export const AppMotionConfig: FC<{ children: ReactNode }> = ({ children }) => {
  const reduce = useMotionPreference();
  return (
    <MotionConfig
      reducedMotion={reduce ? 'always' : 'user'}
      transition={reduce ? { duration: 0 } : undefined}
    >
      {children}
    </MotionConfig>
  );
};

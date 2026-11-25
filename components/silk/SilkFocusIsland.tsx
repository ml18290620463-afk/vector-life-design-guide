import type { HTMLAttributes, FC } from 'react';
import './silk.css';
export const SilkFocusIsland: FC<HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) =>
  <div className={`silk-focus-island ${className}`.trim()} {...props} />;

import type { FC, HTMLAttributes } from 'react';
import './silk.css';
export const SilkInlineActions: FC<HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) =>
  <div className={`silk-inline-actions ${className}`.trim()} {...props} />;

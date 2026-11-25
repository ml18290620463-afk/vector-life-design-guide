import type { ButtonHTMLAttributes, FC } from 'react';
import './silk.css';

export type SilkButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type SilkButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: SilkButtonVariant };

export const SilkButton: FC<SilkButtonProps> = ({ variant = 'primary', className = '', type = 'button', ...props }) => (
  <button type={type} className={`silk-button silk-button--${variant} ${className}`.trim()} {...props} />
);

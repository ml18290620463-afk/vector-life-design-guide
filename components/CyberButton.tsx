import React from 'react';
import { Theme } from '../types';

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost';
  theme?: Theme;
  children: React.ReactNode;
  as?: 'button' | 'label' | 'div';
  htmlFor?: string;
}

export const CyberButton: React.FC<CyberButtonProps> = ({
  variant = 'primary',
  theme = 'dark',
  children,
  className = '',
  as = 'button',
  htmlFor,
  ...props
}) => {
  const baseStyles =
    'relative px-6 py-2 font-mono font-bold uppercase tracking-widest transition-all duration-300 clip-path-polygon group overflow-hidden';

  const variants = {
    primary:
      theme === 'light'
        ? 'bg-white/80 backdrop-blur-xl text-vector-cyan-brand border border-vector-cyan-brand/20 hover:bg-vector-cyan-brand hover:text-white hover:border-vector-cyan-brand hover:shadow-sm'
        : 'bg-vector-cyan-neon/10 text-vector-cyan-neon border border-vector-cyan-neon/70 hover:bg-vector-cyan-neon/20 hover:text-white hover:border-vector-cyan-neon shadow-glow-cyan-neon-soft hover:shadow-glow-cyan-neon',
    danger:
      theme === 'light'
        ? 'bg-white/80 backdrop-blur-xl text-vector-magenta border border-vector-magenta/20 hover:bg-vector-magenta hover:text-white hover:border-vector-magenta hover:shadow-sm'
        : 'bg-vector-magenta/10 text-vector-magenta border border-vector-magenta/50 hover:bg-vector-magenta hover:text-white hover:shadow-glow-vector-magenta-strong shadow-glow-vector-magenta',
    ghost:
      theme === 'light'
        ? 'text-vector-slate-mid hover:text-vector-cyan-brand border border-transparent hover:bg-vector-cyan-brand/5 hover:border-vector-cyan-brand/10'
        : 'text-vector-slate-chrome hover:text-vector-cyan-neon border border-transparent hover:border-vector-cyan-neon/30 hover:bg-vector-cyan-neon/5',
  };

  const content = (
    <>
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>

      {/* Laser sheen effect on hover (Removed for performance) */}
      <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-0 group-hover:opacity-10 transition-opacity" />

      {/* Decorative corner markers */}
      <span className="absolute top-0 left-0 w-2 h-2 border-l-2 border-current opacity-60"></span>
      <span className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-current opacity-60"></span>
    </>
  );

  const composedClassName = `${baseStyles} ${variants[variant]} ${className} ${as === 'label' ? 'cursor-pointer inline-block text-center' : ''}`;

  // W4.1 — propagate data-testid through every polymorphic branch.
  // The HTMLButtonElement spread below already carries it, but the
  // 'label' / 'div' branches need an explicit pass-through.
  const testId = (props as { 'data-testid'?: string })['data-testid'];

  if (as === 'label') {
    // <label htmlFor=...> is keyboard-accessible by definition (focus
    // and Enter/Space go through the bound control), so the extra
    // onClick is a UX shortcut for mouse users only. We do not need a
    // keyboard listener here, so silence the false positive.
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
      <label
        data-testid={testId}
        className={composedClassName}
        htmlFor={htmlFor}
        onClick={props.onClick as unknown as React.MouseEventHandler<HTMLLabelElement> | undefined}
      >
        {content}
      </label>
    );
  }

  if (as === 'div') {
    // Polymorphic "button" rendered as a div. Add the proper button
    // semantics so screen readers announce it correctly and keyboard
    // users can activate it (Enter / Space). Without this jsx-a11y
    // (rightfully) flags the click handler.
    const onClick = props.onClick as unknown as React.MouseEventHandler<HTMLDivElement> | undefined;
    return (
      <div
        data-testid={testId}
        role="button"
        tabIndex={0}
        aria-disabled={props.disabled || undefined}
        className={composedClassName}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <button className={composedClassName} {...props}>
      {content}
    </button>
  );
};

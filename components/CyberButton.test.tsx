import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CyberButton } from './CyberButton';
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('CyberButton', () => {
  afterEach(cleanup);

  it('renders children correctly', () => {
    render(<CyberButton>Click Me</CyberButton>);
    expect(screen.getByText('Click Me')).toBeDefined();
  });

  it('triggers onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<CyberButton onClick={handleClick}>Click Me</CyberButton>);
    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('applies ghost variant classes', () => {
    render(<CyberButton variant="ghost">Ghost</CyberButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-vector-slate-chrome');
    expect(btn.className).toContain('hover:text-vector-cyan-neon');
  });

  it('applies light theme classes', () => {
    render(<CyberButton theme="light">Light</CyberButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-vector-cyan-brand');
  });
});

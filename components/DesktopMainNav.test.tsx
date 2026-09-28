import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesktopMainNav } from './DesktopMainNav';

describe('DesktopMainNav', () => {
  afterEach(cleanup);

  it('renders all main pages and identifies the active one', () => {
    render(<DesktopMainNav activeTab="now" language="en" onNavigate={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /^Now/ }).getAttribute('aria-current')).toBe('page');
  });

  it('requests navigation to the selected page', () => {
    const onNavigate = vi.fn();
    render(<DesktopMainNav activeTab="now" language="en" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /^Avatar/ }));

    expect(onNavigate).toHaveBeenCalledWith('avatar');
  });
});

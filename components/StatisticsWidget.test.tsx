import { render, screen, cleanup } from '@testing-library/react';
import { StatisticsWidget } from './StatisticsWidget';
import { describe, it, expect, afterEach, vi } from 'vitest';

const mockProps = {
  theme: 'dark' as const,
  language: 'zh' as const,
  customIdentity: 'User',
  setCustomIdentity: vi.fn(),
  dynamicVersion: 'v1.0.0',
  isUnlocked: true,
  onSetTheme: vi.fn(),
  onSetLanguage: vi.fn(),
  setSecurityMode: vi.fn(),
  setIsViewingRecovery: vi.fn(),
  passwordHash: null,
};

describe('StatisticsWidget', () => {
  afterEach(cleanup);

  it('renders correctly', () => {
    render(<StatisticsWidget {...mockProps} />);
    expect(screen.getByText(/航行状态/i)).toBeDefined();
  });
});

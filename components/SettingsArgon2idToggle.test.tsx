import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { SettingsArgon2idToggle } from './SettingsArgon2idToggle';
import type { TranslationDictionary } from '../i18n/translations';

const baseT: TranslationDictionary = {
  argon2ToggleTitle: 'Use Argon2id (test)',
  argon2ToggleEnabled: 'On (test)',
  argon2ToggleDisabled: 'Off (test)',
  argon2ToggleHint: 'Hint copy (test)',
};

describe('SettingsArgon2idToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders the disabled state when no flag is set', () => {
    render(<SettingsArgon2idToggle theme="dark" t={baseT} />);
    const toggle = screen.getByTestId('argon2id-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Off (test)')).not.toBeNull();
  });

  it('renders the enabled state when both verifier + minter flags are set', () => {
    localStorage.setItem('vector_argon2_verify', '1');
    localStorage.setItem('vector_argon2_minter', '1');
    render(<SettingsArgon2idToggle theme="dark" t={baseT} />);
    const toggle = screen.getByTestId('argon2id-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('On (test)')).not.toBeNull();
  });

  it('renders disabled when minter flag is on but verifier flag is off (verify ≥ mint)', () => {
    localStorage.setItem('vector_argon2_minter', '1');
    render(<SettingsArgon2idToggle theme="dark" t={baseT} />);
    const toggle = screen.getByTestId('argon2id-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('clicking the switch enables both verifier and minter flags', () => {
    render(<SettingsArgon2idToggle theme="dark" t={baseT} />);
    const toggle = screen.getByTestId('argon2id-toggle');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem('vector_argon2_minter')).toBe('1');
    expect(localStorage.getItem('vector_argon2_verify')).toBe('1');
  });

  it('clicking again clears the minter flag but leaves verifier on (orphan-safety)', () => {
    localStorage.setItem('vector_argon2_verify', '1');
    localStorage.setItem('vector_argon2_minter', '1');
    render(<SettingsArgon2idToggle theme="dark" t={baseT} />);
    const toggle = screen.getByTestId('argon2id-toggle');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(localStorage.getItem('vector_argon2_minter')).toBeNull();
    expect(localStorage.getItem('vector_argon2_verify')).toBe('1');
  });

  it('falls back to English defaults when translation keys are missing', () => {
    render(<SettingsArgon2idToggle theme="dark" t={{} as TranslationDictionary} />);
    expect(screen.getByText('Use Argon2id for new passwords')).not.toBeNull();
    expect(screen.getByText('Disabled (PBKDF2 default)')).not.toBeNull();
  });

  it('renders consistently in light theme', () => {
    render(<SettingsArgon2idToggle theme="light" t={baseT} />);
    expect(screen.getByTestId('argon2id-toggle')).not.toBeNull();
    expect(screen.getByText('Use Argon2id (test)')).not.toBeNull();
  });
});

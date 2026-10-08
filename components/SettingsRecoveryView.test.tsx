import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsRecoveryView } from './SettingsRecoveryView';
import { TRANSLATIONS } from '../constants';
import { AppStorageKeys } from '../services/appSettings';
import { removeStoredValue, setStoredString } from '../services/browserStorage';

const t = TRANSLATIONS.zh;

beforeEach(() => {
  removeStoredValue(AppStorageKeys.recoveryVerifier);
});

afterEach(() => {
  removeStoredValue(AppStorageKeys.recoveryVerifier);
});

describe('SettingsRecoveryView', () => {
  it('renders the localised "emergency anchor" heading', () => {
    render(<SettingsRecoveryView theme="dark" language="zh" t={t} onBack={vi.fn()} />);
    expect(screen.getByText(t.emergencyAnchor)).toBeTruthy();
  });

  it('shows the "not generated" copy when recoveryVerifier is missing', () => {
    render(<SettingsRecoveryView theme="dark" language="zh" t={t} onBack={vi.fn()} />);
    expect(screen.getByText(/尚未生成凭证/)).toBeTruthy();
  });

  it('shows the "stored" copy when recoveryVerifier is present', () => {
    setStoredString(AppStorageKeys.recoveryVerifier, 'rk-hash');
    render(<SettingsRecoveryView theme="dark" language="zh" t={t} onBack={vi.fn()} />);
    expect(screen.getByText(/已安全保存校验指纹/)).toBeTruthy();
  });

  it('renders the warning banner with role="alert"', () => {
    render(<SettingsRecoveryView theme="dark" language="zh" t={t} onBack={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(t.recoveryKeyWarning);
  });

  it('clicking either back affordance triggers onBack', () => {
    const onBack = vi.fn();
    render(<SettingsRecoveryView theme="dark" language="zh" t={t} onBack={onBack} />);
    fireEvent.click(screen.getByLabelText(t.backToConsole));
    fireEvent.click(screen.getByText(t.backToConsole));
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('switches to the English copy when language="en"', () => {
    setStoredString(AppStorageKeys.recoveryVerifier, 'rk-hash');
    const en = TRANSLATIONS.en;
    render(<SettingsRecoveryView theme="dark" language="en" t={en} onBack={vi.fn()} />);
    expect(screen.getByText(/RECOVERY VERIFIER STORED/)).toBeTruthy();
  });
});

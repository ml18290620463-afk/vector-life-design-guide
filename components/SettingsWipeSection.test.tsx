import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsWipeSection } from './SettingsWipeSection';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  wipeInput: '',
  setWipeInput: vi.fn(),
  onConfirmWipe: vi.fn(),
  onCancel: vi.fn(),
};

describe('SettingsWipeSection', () => {
  it('renders the localised heading + descriptions', () => {
    render(<SettingsWipeSection {...baseProps} />);
    expect(screen.getByText(t.wipeData)).toBeTruthy();
    expect(screen.getByText(t.wipeDataDesc)).toBeTruthy();
  });

  it('confirm button is disabled when wipeInput !== "DELETE"', () => {
    render(<SettingsWipeSection {...baseProps} wipeInput="hello" />);
    const button = screen.getByText(t.confirmWipe) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('confirm button is enabled and clickable when wipeInput === "DELETE"', () => {
    const onConfirmWipe = vi.fn();
    render(<SettingsWipeSection {...baseProps} wipeInput="DELETE" onConfirmWipe={onConfirmWipe} />);
    const button = screen.getByText(t.confirmWipe) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onConfirmWipe).toHaveBeenCalled();
  });

  it('typing into the input flows back through setWipeInput', () => {
    const setWipeInput = vi.fn();
    render(<SettingsWipeSection {...baseProps} setWipeInput={setWipeInput} />);
    fireEvent.change(screen.getByLabelText(t.wipeDataConfirm), { target: { value: 'DEL' } });
    expect(setWipeInput).toHaveBeenCalledWith('DEL');
  });

  it('cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    render(<SettingsWipeSection {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText(t.btnCancel));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not call onConfirmWipe when the disabled button is clicked', () => {
    const onConfirmWipe = vi.fn();
    render(<SettingsWipeSection {...baseProps} wipeInput="" onConfirmWipe={onConfirmWipe} />);
    fireEvent.click(screen.getByText(t.confirmWipe));
    expect(onConfirmWipe).not.toHaveBeenCalled();
  });
});

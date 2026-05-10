import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsMaterialSection } from './SettingsMaterialSection';
import { TRANSLATIONS } from '../constants';
import type { Attachment } from '../types';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  mediaInputRef: createRef<HTMLInputElement | null>(),
  isUploading: false,
  stagedMaterial: null as Attachment | null,
  setStagedMaterial: vi.fn(),
  onCreateMaterialEntry: vi.fn(),
  onMaterialSaved: vi.fn(),
  mediaError: null as string | null,
  mediaSuccess: null as string | null,
};

describe('SettingsMaterialSection', () => {
  it('renders the upload button with the localised label', () => {
    render(<SettingsMaterialSection {...baseProps} />);
    expect(screen.getByText(t.loadSupply)).toBeTruthy();
  });

  it('shows the "uploading" copy and disables the button when isUploading=true', () => {
    render(<SettingsMaterialSection {...baseProps} isUploading />);
    const button = screen.getByText(t.isUploading).closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('hides the staged-material card when stagedMaterial is null', () => {
    render(<SettingsMaterialSection {...baseProps} />);
    expect(screen.queryByText('STAGED_READY')).toBeNull();
  });

  it('renders the staged-material card with name + STAGED_READY badge', () => {
    const stagedMaterial: Attachment = {
      type: 'image',
      name: 'photo.png',
      data: 'data:image/png',
      mimeType: 'image/png',
    };
    render(<SettingsMaterialSection {...baseProps} stagedMaterial={stagedMaterial} />);
    expect(screen.getByText('photo.png')).toBeTruthy();
    expect(screen.getByText('STAGED_READY')).toBeTruthy();
  });

  it('Save button on the staged card calls onCreateMaterialEntry + clears staged + onMaterialSaved', () => {
    const onCreate = vi.fn();
    const setStaged = vi.fn();
    const onSaved = vi.fn();
    const stagedMaterial: Attachment = {
      type: 'image',
      name: 'photo.png',
      data: 'data:image/png',
      mimeType: 'image/png',
    };
    render(
      <SettingsMaterialSection
        {...baseProps}
        stagedMaterial={stagedMaterial}
        onCreateMaterialEntry={onCreate}
        setStagedMaterial={setStaged}
        onMaterialSaved={onSaved}
      />,
    );
    fireEvent.click(screen.getByText(t.save));
    expect(onCreate).toHaveBeenCalledWith(stagedMaterial, false);
    expect(setStaged).toHaveBeenCalledWith(null);
    expect(onSaved).toHaveBeenCalled();
  });

  it('renders mediaError as role="alert" and mediaSuccess as role="status"', () => {
    const { rerender } = render(<SettingsMaterialSection {...baseProps} mediaError="too big" />);
    expect(screen.getByRole('alert').textContent).toContain('too big');
    rerender(<SettingsMaterialSection {...baseProps} mediaSuccess="all good" />);
    expect(screen.getByRole('status').textContent).toContain('all good');
  });
});

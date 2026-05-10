import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsGuidingStarsSection } from './SettingsGuidingStarsSection';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  language: 'zh' as const,
  t,
  selectedStars: ['Alpha', 'Beta'],
  isEditing: false,
  setIsEditing: vi.fn(),
  tempDirectory: ['Alpha', 'Beta', 'Gamma'],
  tempSelected: ['Alpha'],
  customStarName: '',
  setCustomStarName: vi.fn(),
  onToggleStar: vi.fn(),
  onDeleteCustomStar: vi.fn(),
  onAddCustomStar: vi.fn(),
  onSave: vi.fn(),
};

describe('SettingsGuidingStarsSection', () => {
  it('renders the persisted selection joined with "、" when not editing', () => {
    render(<SettingsGuidingStarsSection {...baseProps} />);
    expect(screen.getByText('Alpha、Beta')).toBeTruthy();
  });

  it('clicking the Edit button enters editing mode via setIsEditing', () => {
    const setIsEditing = vi.fn();
    render(<SettingsGuidingStarsSection {...baseProps} setIsEditing={setIsEditing} />);
    fireEvent.click(screen.getByText(t.edit));
    expect(setIsEditing).toHaveBeenCalledWith(true);
  });

  it('renders one chip per directory entry when editing', () => {
    render(<SettingsGuidingStarsSection {...baseProps} isEditing />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  it('clicking a chip toggles via onToggleStar', () => {
    const onToggleStar = vi.fn();
    render(<SettingsGuidingStarsSection {...baseProps} isEditing onToggleStar={onToggleStar} />);
    fireEvent.click(screen.getByLabelText('toggle Beta'));
    expect(onToggleStar).toHaveBeenCalledWith('Beta');
  });

  it('Enter key in the custom-name input triggers onAddCustomStar', () => {
    const onAddCustomStar = vi.fn();
    render(
      <SettingsGuidingStarsSection
        {...baseProps}
        isEditing
        customStarName="NewStar"
        onAddCustomStar={onAddCustomStar}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText(t.defineYourself), { key: 'Enter' });
    expect(onAddCustomStar).toHaveBeenCalled();
  });

  it('Save button calls onSave', () => {
    const onSave = vi.fn();
    render(<SettingsGuidingStarsSection {...baseProps} isEditing onSave={onSave} />);
    fireEvent.click(screen.getByText(t.save));
    expect(onSave).toHaveBeenCalled();
  });

  it('shows "N / 3" counter and turns green at 3', () => {
    const { rerender, container } = render(
      <SettingsGuidingStarsSection {...baseProps} isEditing tempSelected={['A']} />,
    );
    expect(screen.getByText('1 / 3')).toBeTruthy();
    rerender(
      <SettingsGuidingStarsSection {...baseProps} isEditing tempSelected={['A', 'B', 'C']} />,
    );
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(container.querySelector('[class*="text-green"]')).toBeTruthy();
  });
});

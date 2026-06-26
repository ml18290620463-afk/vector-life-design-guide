import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel';
import { TRANSLATIONS } from '../constants';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ComponentProps } from 'react';

const mockProps: ComponentProps<typeof SettingsPanel> = {
  theme: 'dark',
  language: 'zh',
  onSetLanguage: vi.fn(),
  showSettings: true,
  setShowSettings: vi.fn(),
  isViewingRecovery: false,
  setIsViewingRecovery: vi.fn(),
  securityMode: 'idle',
  setSecurityMode: vi.fn(),
  passwordHash: null,
  customIdentity: '',
  setCustomIdentity: vi.fn(),
  dynamicVersion: '1.0',
  isUnlocked: true,
  onSetTheme: vi.fn(),
  oldPassword: '',
  setOldPassword: vi.fn(),
  newPassword: '',
  setNewPassword: vi.fn(),
  confirmPassword: '',
  setConfirmPassword: vi.fn(),
  securityError: null,
  securitySuccess: null,
  handleSecuritySetup: vi.fn(),
  isEditingStars: false,
  setIsEditingStars: vi.fn(),
  tempDirectory: [],
  tempSelected: [],
  customStarName: '',
  setCustomStarName: vi.fn(),
  toggleTempStar: vi.fn(),
  handleDeleteCustomStar: vi.fn(),
  handleAddCustomStar: vi.fn(),
  handleSaveStars: vi.fn(),
  selectedStars: [],
  mediaInputRef: { current: null },
  handleMediaUpload: vi.fn(),
  isUploading: false,
  stagedMaterial: null,
  setStagedMaterial: vi.fn(),
  onCreateMaterialEntry: vi.fn(),
  setMediaSuccess: vi.fn(),
  mediaError: null,
  mediaSuccess: null,
  activeEntries: [],
  handleExport: vi.fn(),
  dropdownRef: { current: null },
  isExportDropdownOpen: false,
  setIsExportDropdownOpen: vi.fn(),
  exportTarget: '',
  setExportTarget: vi.fn(),
  handleDownloadNotes: vi.fn(),
  entries: [],
  wipeInput: '',
  setWipeInput: vi.fn(),
  handleWipeConfirm: vi.fn(),
  setWipeMode: vi.fn(),
  handleGoHomeClick: vi.fn(),
  isSailingHome: false,
};

describe('SettingsPanel', () => {
  afterEach(cleanup);

  it('renders correctly when showSettings is true', () => {
    render(<SettingsPanel {...mockProps} />);
    expect(screen.getByText(/航行日志/i)).toBeDefined();
  });

  it('renders security setup when securityMode is setup', () => {
    render(<SettingsPanel {...mockProps} securityMode="setup" />);
    // Check for "通行密令" header
    expect(screen.getByText(/通行密令/i)).toBeDefined();
  });

  it('renders recovery view when isViewingRecovery is true', () => {
    render(<SettingsPanel {...mockProps} isViewingRecovery={true} />);
    // It's 救急锚点
    expect(screen.getAllByText(/救急锚点/i)[0]).toBeDefined();
  });

  it('renders star editing when isEditingStars is true', () => {
    const t = TRANSLATIONS[mockProps.language];
    render(<SettingsPanel {...mockProps} isEditingStars={true} />);
    expect(screen.getByText(t.guidingStarsCatalog)).toBeDefined();
  });

  it('calls setShowSettings when close is clicked', () => {
    render(<SettingsPanel {...mockProps} />);
    const closeBtn = screen.getAllByRole('button').find((b) => b.querySelector('.lucide-x'));
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(mockProps.setShowSettings).toHaveBeenCalledWith(false);
    }
  });
});

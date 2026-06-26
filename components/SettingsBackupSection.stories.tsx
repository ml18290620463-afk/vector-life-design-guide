import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SettingsBackupSection } from './SettingsBackupSection';
import { baseEntry, lockedEntry, tZh } from '../.storybook/mocks';

const meta = {
  title: 'Cells/SettingsBackupSection',
  component: SettingsBackupSection,
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    isExportDropdownOpen: { control: 'boolean' },
  },
  args: {
    theme: 'dark',
    t: tZh,
    onExport: fn(),
    onDownloadNotes: fn(),
    exportTarget: 'all',
    setExportTarget: fn(),
    isExportDropdownOpen: false,
    setIsExportDropdownOpen: fn(),
    dropdownRef: { current: null },
    entries: [
      baseEntry({ id: 'e-001', title: 'Cognitive Sovereignty', tags: ['#meta'] }),
      baseEntry({
        id: 'e-002',
        title: 'On Recursive Doubt',
        tags: ['#philosophy'],
        createdAt: Date.UTC(2025, 4, 1),
      }),
      lockedEntry({ id: 'e-003', title: 'Sealed: Future Self' }),
    ],
    importInputRef: undefined,
    onImportBackup: undefined,
    importStatus: null,
  },
} satisfies Meta<typeof SettingsBackupSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default closed-dropdown rendering. */
export const Closed: Story = {};

/** Dropdown open — picker shows the "all entries" target plus
 *  one row per entry. */
export const DropdownOpen: Story = {
  args: { isExportDropdownOpen: true },
};

/** Light-mode paper rendering. */
export const Light: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'paper' } },
};

/** Import success banner inline. */
export const ImportSuccess: Story = {
  args: {
    onImportBackup: fn(),
    importInputRef: { current: null },
    importStatus: { kind: 'success', message: 'Restored 12 entries.' },
  },
};

/** Import error banner inline. */
export const ImportError: Story = {
  args: {
    onImportBackup: fn(),
    importInputRef: { current: null },
    importStatus: { kind: 'error', message: 'Backup file is malformed.' },
  },
};

/** Interactive — local state binds the dropdown open/close
 *  affordance and the export-target picker. */
export const Interactive: Story = {
  render: function InteractiveStory(args) {
    const [open, setOpen] = useState(args.isExportDropdownOpen);
    const [target, setTarget] = useState(args.exportTarget);
    const ref = useRef<HTMLDivElement | null>(null);
    return (
      <SettingsBackupSection
        {...args}
        isExportDropdownOpen={open}
        setIsExportDropdownOpen={setOpen}
        exportTarget={target}
        setExportTarget={setTarget}
        dropdownRef={ref}
      />
    );
  },
};

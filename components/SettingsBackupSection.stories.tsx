import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SettingsBackupSection } from './SettingsBackupSection';
import { tZh } from '../.storybook/mocks';

const meta = {
  title: 'Cells/SettingsBackupSection',
  component: SettingsBackupSection,
  tags: ['autodocs'],
  argTypes: { theme: { control: 'inline-radio', options: ['dark', 'light'] } },
  args: {
    theme: 'dark',
    t: tZh,
    onExport: fn(),
    importInputRef: undefined,
    onImportBackup: undefined,
    importStatus: null,
  },
} satisfies Meta<typeof SettingsBackupSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Light: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'paper' } },
};
export const RestoreSuccess: Story = {
  args: {
    onImportBackup: fn(),
    importInputRef: { current: null },
    importStatus: { kind: 'success', message: 'Restored 12 entries.' },
  },
};
export const RestoreError: Story = {
  args: {
    onImportBackup: fn(),
    importInputRef: { current: null },
    importStatus: { kind: 'error', message: 'Backup file is malformed.' },
  },
};

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StatisticsIdentityCard } from './StatisticsIdentityCard';
import { tZh } from '../.storybook/mocks';

const meta = {
  title: 'Cells/StatisticsIdentityCard',
  component: StatisticsIdentityCard,
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    isUnlocked: { control: 'boolean' },
    customIdentity: { control: 'text' },
    dynamicVersion: { control: 'text' },
  },
  args: {
    theme: 'dark',
    t: tZh,
    customIdentity: 'Captain Marlow',
    setCustomIdentity: fn(),
    dynamicVersion: 'v1.0.5 — Stardust',
    isUnlocked: true,
    onOpenSecuritySetup: fn(),
  },
} satisfies Meta<typeof StatisticsIdentityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default rendering: encrypted vault is unlocked, custom
 *  identity is filled in, dynamic version label visible. */
export const UnlockedDark: Story = {};

/** Light-mode paper variant. */
export const UnlockedLight: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'light' } },
};

/** Locked vault state — the security-calibration row becomes a
 *  primary call-to-action that opens the master-password flow. */
export const Locked: Story = {
  args: { isUnlocked: false, customIdentity: '' },
};

/** Editable identity (controlled, two-way bound). The story keeps
 *  local state so you can type into the input live in the addon. */
export const Editable: Story = {
  render: function EditableStory(args) {
    const [value, setValue] = useState(args.customIdentity);
    return <StatisticsIdentityCard {...args} customIdentity={value} setCustomIdentity={setValue} />;
  },
};

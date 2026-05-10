import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FilterBar } from './FilterBar';

const meta = {
  title: 'Cells/FilterBar',
  component: FilterBar,
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    language: { control: 'select', options: ['zh', 'en'] },
    isVaultOpen: { control: 'boolean' },
    isEditingStars: { control: 'boolean' },
  },
  args: {
    theme: 'dark',
    language: 'zh',
    showFilterHub: true,
    isVaultOpen: false,
    onToggleVault: fn(),
    selectedTag: null,
    setSelectedTag: fn(),
    selectedCategory: 'all',
    setSelectedCategory: fn(),
    searchQuery: '',
    setSearchQuery: fn(),
    groupingMode: 'none',
    setGroupingMode: fn(),
    isEditingStars: false,
    entriesCount: 23,
  },
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default closed-vault rendering. */
export const Closed: Story = {};

/** Vault-open state — the bio-vault badge becomes "live". */
export const VaultOpen: Story = {
  args: { isVaultOpen: true },
};

/** Light-mode rendering. */
export const Light: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'light' } },
};

/** Editing-stars mode — collapses the bottom border. */
export const EditingStars: Story = {
  args: { isEditingStars: true },
};

/** Interactive — local state lets you toggle the vault and
 *  search via the Storybook canvas. */
export const Interactive: Story = {
  render: function InteractiveStory(args) {
    const [isVaultOpen, setVault] = useState(args.isVaultOpen);
    const [search, setSearch] = useState(args.searchQuery);
    return (
      <FilterBar
        {...args}
        isVaultOpen={isVaultOpen}
        onToggleVault={() => setVault((v) => !v)}
        searchQuery={search}
        setSearchQuery={setSearch}
      />
    );
  },
};

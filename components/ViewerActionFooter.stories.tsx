import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ViewerActionFooter } from './ViewerActionFooter';
import { baseEntry, sampleContainers, tZh } from '../.storybook/mocks';

const meta = {
  title: 'Cells/ViewerActionFooter',
  component: ViewerActionFooter,
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    showPackingMenu: { control: 'boolean' },
  },
  args: {
    theme: 'dark',
    t: tZh,
    entry: baseEntry(),
    containers: sampleContainers,
    showPackingMenu: false,
    onTogglePackingMenu: fn(),
    onMoveToContainer: fn(),
    onArchiveOrRestore: fn(),
    onDownload: fn(),
    onRequestBurn: fn(),
  },
} satisfies Meta<typeof ViewerActionFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default footer with "archive" affordance. */
export const Archivable: Story = {};

/** Already-archived entry — primary CTA flips to "restore". */
export const Archived: Story = {
  args: { entry: baseEntry({ isArchived: true }) },
};

/** Packing-menu open — exposes the per-container destination
 *  list plus the "uncategorised" fallback. */
export const PackingMenuOpen: Story = {
  args: { showPackingMenu: true },
};

/** Light-mode rendering. */
export const Light: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'light' } },
};

/** Interactive — local state lets you open / close the packing
 *  dropdown by clicking the central CTA. */
export const Interactive: Story = {
  render: function InteractiveStory(args) {
    const [open, setOpen] = useState(args.showPackingMenu);
    return (
      <ViewerActionFooter
        {...args}
        showPackingMenu={open}
        onTogglePackingMenu={() => setOpen((v) => !v)}
      />
    );
  },
};

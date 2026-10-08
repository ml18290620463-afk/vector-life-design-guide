import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ArchiveEntryCard } from './ArchiveEntryCard';
import { baseEntry, lockedEntry, tZh } from '../.storybook/mocks';

const meta = {
  title: 'Cells/ArchiveEntryCard',
  component: ArchiveEntryCard,
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    isListView: { control: 'boolean' },
  },
  args: {
    theme: 'dark',
    t: tZh,
    entry: baseEntry(),
    index: 1,
    isListView: false,
    delayIndex: 0,
    now: Date.UTC(2025, 5, 16),
    onSelect: fn(),
  },
} satisfies Meta<typeof ArchiveEntryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Dark-mode grid card — the dominant rendering inside the
 *  archive vault year buckets. */
export const GridDark: Story = {};

/** Light-mode grid card. Same component, paper colour scheme. */
export const GridLight: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'light' } },
};

/** List view: triggered automatically when a bucket has > 10
 *  entries; renders as a flat row instead of a grid card. */
export const ListView: Story = {
  args: { isListView: true },
};

/** Time-locked entry — `unlockAt > now` flips the desaturated
 *  style and renders the lock badge in the top-right. */
export const TimeLocked: Story = {
  args: {
    entry: lockedEntry({ tags: ['#future-self'] }),
  },
};

/** Locked + encrypted entry with no tags. Demonstrates the
 *  fallback rendering when the spine badge is the only metadata. */
export const Sealed: Story = {
  args: {
    entry: lockedEntry({ tags: [] }),
  },
};

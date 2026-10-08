import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ViewerActionFooter } from './ViewerActionFooter';
import { tZh } from '../.storybook/mocks';

const meta = {
  title: 'Cells/ViewerActionFooter',
  component: ViewerActionFooter,
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
  },
  args: {
    theme: 'dark',
    t: tZh,
    onDownload: fn(),
    onRequestBurn: fn(),
    onShareCard: fn(),
    onOpenAvatar: fn(),
  },
} satisfies Meta<typeof ViewerActionFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'light' } },
};

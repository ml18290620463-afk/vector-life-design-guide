import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CoverScreen } from './CoverScreen';
import { samplePrinciples } from '../.storybook/mocks';

const meta = {
  title: 'Screens/CoverScreen',
  component: CoverScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    language: { control: 'select', options: ['zh', 'en'] },
  },
  args: {
    onStart: fn(),
    language: 'zh',
    principles: samplePrinciples,
    theme: 'dark',
  },
} satisfies Meta<typeof CoverScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default landing — STAR_TUNNEL variant on dark surface. */
export const Default: Story = {};

/** English copy on dark surface. */
export const EnglishDark: Story = {
  args: { language: 'en' },
};

/** Light-mode rendering — pale-paper surface with the same
 *  4-version cover-screen carousel. */
export const Light: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'paper' } },
};

/** Empty-principles state — runs the cover-screen carousel
 *  without any user-supplied principles below the heading. */
export const NoPrinciples: Story = {
  args: { principles: [] },
};

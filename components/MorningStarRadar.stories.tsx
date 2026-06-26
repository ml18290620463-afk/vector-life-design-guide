import type { Meta, StoryObj } from '@storybook/react-vite';
import { MorningStarRadar } from './MorningStarRadar';
import { sampleMorningStarMetrics, tZh } from '../.storybook/mocks';

const meta = {
  title: 'Cells/MorningStarRadar',
  component: MorningStarRadar,
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
  },
  args: {
    theme: 'dark',
    t: tZh,
    metrics: sampleMorningStarMetrics,
  },
} satisfies Meta<typeof MorningStarRadar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Balanced profile across the five reflection axes. */
export const BalancedDark: Story = {};

/** Light-mode rendering. Rose / violet / emerald axis colours
 *  swap to their darker shades for paper-mode contrast. */
export const BalancedLight: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'light' } },
};

/** Skewed profile — reflective + future-focused but emotionally
 *  flat. Useful for verifying the radar's polygon shape extremes. */
export const Skewed: Story = {
  args: {
    metrics: {
      rationality: 0.95,
      emotionality: 0.15,
      futureFocus: 0.85,
      selfReflection: 0.95,
      resilience: 0.4,
    },
  },
};

/** Empty / fresh profile (all zeros). The polygon collapses
 *  to the centre and only the axis labels remain. */
export const Empty: Story = {
  args: {
    metrics: {
      rationality: 0,
      emotionality: 0,
      futureFocus: 0,
      selfReflection: 0,
      resilience: 0,
    },
  },
};

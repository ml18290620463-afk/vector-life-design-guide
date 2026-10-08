import type { Meta, StoryObj } from '@storybook/react-vite';
import { ValleyParticleLandscape } from './ValleyParticleLandscape';

const meta = {
  title: 'Atmosphere/ValleyParticleLandscape',
  component: ValleyParticleLandscape,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ValleyParticleLandscape>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="relative min-h-screen w-full bg-[#c6ced4]">
      <ValleyParticleLandscape />
    </div>
  ),
};

export const Dense: Story = {
  render: () => (
    <div className="relative min-h-screen w-full bg-[#c6ced4]">
      <ValleyParticleLandscape particleBudget={3200} />
    </div>
  ),
};

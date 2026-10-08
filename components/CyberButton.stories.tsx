import type { Meta, StoryObj } from '@storybook/react-vite';
import { CyberButton } from './CyberButton';

const meta = {
  title: 'Atoms/CyberButton',
  component: CyberButton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'danger', 'ghost'] },
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    as: { control: 'inline-radio', options: ['button', 'label', 'div'] },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    variant: 'primary',
    theme: 'dark',
    as: 'button',
    disabled: false,
    children: 'Engage',
  },
} satisfies Meta<typeof CyberButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default primary button on the dark cyberpunk surface. */
export const Primary: Story = {};

/** Danger variant — magenta neon for destructive operations. */
export const Danger: Story = {
  args: { variant: 'danger', children: 'Burn Entry' },
};

/** Ghost variant — transparent affordance for secondary actions. */
export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Skip' },
};

/** Light-mode primary, used in the paper theme of the journal. */
export const PrimaryLight: Story = {
  args: { theme: 'light', children: 'Start' },
  parameters: { backgrounds: { default: 'light' } },
};

/** Disabled state — visually muted, click handler suppressed. */
export const Disabled: Story = {
  args: { disabled: true, children: 'Locked' },
};

/** Polymorphic render: `as="div"` adds button semantics
 * (`role="button"`, `tabIndex={0}`, Enter / Space activation). */
export const AsDiv: Story = {
  args: { as: 'div', children: 'Polymorphic Div' },
};

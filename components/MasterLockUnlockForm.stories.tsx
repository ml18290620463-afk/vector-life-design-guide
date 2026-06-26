import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MasterLockUnlockForm } from './MasterLockUnlockForm';
import { tZh } from '../.storybook/mocks';

const meta = {
  title: 'Cells/MasterLockUnlockForm',
  component: MasterLockUnlockForm,
  tags: ['autodocs'],
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    isDecrypting: { control: 'boolean' },
    isScanning: { control: 'boolean' },
    isSuccess: { control: 'boolean' },
    isRitualActive: { control: 'boolean' },
    error: { control: 'boolean' },
  },
  args: {
    theme: 'dark',
    language: 'zh',
    t: tZh,
    password: '',
    onPasswordChange: fn(),
    showUnlockPassword: false,
    onToggleShowPassword: fn(),
    onSubmit: fn(),
    isDecrypting: false,
    isScanning: false,
    isSuccess: false,
    isRitualActive: false,
    error: false,
    biometricError: null,
    lockout: { isLocked: false, secondsRemaining: 0 },
    onForgotPassword: fn(),
  },
} satisfies Meta<typeof MasterLockUnlockForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default empty input on the dark master-lock surface. */
export const Idle: Story = {};

/** Wrong password — magenta alert ring + neon-glow border. */
export const Error: Story = {
  args: { error: true, password: 'wrongpass' },
};

/** Lockout active — disables the input and shows the cooldown
 *  countdown next to the alert ring. */
export const LockedOut: Story = {
  args: {
    error: true,
    lockout: { isLocked: true, secondsRemaining: 47 },
  },
};

/** Biometric scanning in flight — shows the WebAuthn rotating
 *  scan icon and freezes the input. */
export const Scanning: Story = {
  args: { isScanning: true },
};

/** Verified — green check, ritual playing on the parent. */
export const Success: Story = {
  args: { isSuccess: true, isRitualActive: true, password: '••••••••' },
};

/** Light-mode rendering. */
export const Light: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'paper' } },
};

/** Interactive — local state lets you type into the password
 *  input and toggle the show-password eye icon. */
export const Interactive: Story = {
  render: function InteractiveStory(args) {
    const [password, setPassword] = useState(args.password);
    const [show, setShow] = useState(args.showUnlockPassword);
    return (
      <MasterLockUnlockForm
        {...args}
        password={password}
        onPasswordChange={setPassword}
        showUnlockPassword={show}
        onToggleShowPassword={() => setShow((s) => !s)}
      />
    );
  },
};

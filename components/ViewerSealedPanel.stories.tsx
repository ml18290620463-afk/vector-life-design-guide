import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ViewerSealedPanel } from './ViewerSealedPanel';
import { baseEntry, lockedEntry, tZh } from '../.storybook/mocks';

const sampleStars = [
  { top: '12%', right: '18%', duration: 4.2, delay: 0.3 },
  { top: '37%', right: '76%', duration: 5.1, delay: 0.9 },
  { top: '74%', right: '32%', duration: 6.4, delay: 0.0 },
];

const meta = {
  title: 'Screens/ViewerSealedPanel',
  component: ViewerSealedPanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', backgrounds: { default: 'dark' } },
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    viewState: { control: 'inline-radio', options: ['sealed', 'opening', 'reading'] },
    isScanning: { control: 'boolean' },
    isTimeLocked: { control: 'boolean' },
  },
  args: {
    theme: 'dark',
    t: tZh,
    entry: baseEntry({ isLocked: true, isEncrypted: true }),
    displayIdentity: 'Captain Marlow',
    viewState: 'sealed',
    decryptionPassword: '',
    setDecryptionPassword: fn(),
    decryptionError: null,
    biometricError: null,
    isScanning: false,
    lockoutUntil: null,
    isTimeLocked: false,
    timeLeft: null,
    rippleStars: sampleStars,
    onOpenLetter: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof ViewerSealedPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default sealed envelope — password input + unlock CTA. */
export const Sealed: Story = {};

/** Wrong-password feedback under the input. */
export const WrongPassword: Story = {
  args: {
    decryptionPassword: 'tryagain',
    decryptionError: 'Decryption failed. Please try again.',
  },
};

/** Time-locked entry — the unlock CTA is suppressed in favour
 *  of a countdown until `unlockAt`. */
export const TimeLocked: Story = {
  args: {
    entry: lockedEntry({ unlockAt: Date.UTC(2030, 11, 31) }),
    isTimeLocked: true,
    timeLeft: { d: 1827, h: 6, m: 12, s: 9 },
  },
};

/** WebAuthn biometric prompt in flight. */
export const Scanning: Story = {
  args: { isScanning: true },
};

/** Light-mode rendering. */
export const Light: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'paper' } },
};

/** Interactive — type into the password input and hit "open
 *  letter" to fire the parent handler. */
export const Interactive: Story = {
  render: function InteractiveStory(args) {
    const [pw, setPw] = useState(args.decryptionPassword);
    return <ViewerSealedPanel {...args} decryptionPassword={pw} setDecryptionPassword={setPw} />;
  },
};

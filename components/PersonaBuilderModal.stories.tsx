import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PersonaBuilderModal } from './PersonaBuilderModal';
import { tZh } from '../.storybook/mocks';
import type { PaywallVerdict } from '../services/quotaService';

const okVerdict: PaywallVerdict = {
  reason: 'ok',
  blocked: false,
  tier: 'stardust',
  limit: 5,
  used: 1,
  suggestedUpgrade: 'polaris',
};

const blockedFreeVerdict: PaywallVerdict = {
  reason: 'free-tier-no-personas',
  blocked: true,
  tier: 'free',
  limit: 0,
  used: 0,
  suggestedUpgrade: 'stardust',
};

const blockedLimitVerdict: PaywallVerdict = {
  reason: 'tier-limit-reached',
  blocked: true,
  tier: 'stardust',
  limit: 5,
  used: 5,
  suggestedUpgrade: 'polaris',
};

const meta: Meta<typeof PersonaBuilderModal> = {
  title: 'Cells/PersonaBuilderModal',
  component: PersonaBuilderModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  argTypes: {
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
  },
  args: {
    open: true,
    onClose: fn(),
    theme: 'dark',
    language: 'zh',
    t: tZh,
    paywallVerdict: okVerdict,
    onUpgrade: fn(),
    onPersonaCreated: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof PersonaBuilderModal>;

/**
 * Wizard surface — paid tier (Stardust). The user has 1 of 5 custom
 * personas filled and is about to add another. Step 1 of 6 is shown.
 */
export const WizardStardust: Story = {};

/**
 * Wizard surface in light theme.
 */
export const WizardLight: Story = {
  args: { theme: 'light' },
  parameters: { backgrounds: { default: 'light' } },
};

/**
 * Free tier paywall — the most common touch point. Renders the
 * "upgrade to Stardust" CTA instead of the wizard.
 */
export const PaywallFreeNoPersonas: Story = {
  args: { paywallVerdict: blockedFreeVerdict },
};

/**
 * Stardust at quota cap — the wizard refuses creation and offers
 * the upgrade-to-Polaris CTA.
 */
export const PaywallStardustAtLimit: Story = {
  args: { paywallVerdict: blockedLimitVerdict },
};

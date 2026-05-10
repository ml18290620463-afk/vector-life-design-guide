import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShareCard, type ShareCardLabels } from './ShareCard';
import { SHARE_CARD_DEFAULT_OPTIONS } from '../hooks/useShareCardOptions';
import { baseEntry, lockedEntry } from '../.storybook/mocks';

const labels: ShareCardLabels = {
  eyebrow: 'VECTOR · Reflection card',
  bodyMaskedPlaceholder:
    'Body content hidden by default. Toggle "Show body" to include it in the export.',
  footerAttribution: 'Local-first journal · vectorlife.app',
  attachmentBadge: 'Has attachment',
  emptyBodyPlaceholder: '(no body)',
};

const meta = {
  title: 'Cards/ShareCard',
  component: ShareCard,
  tags: ['autodocs'],
  // Always render the card at the 1/3 preview scale so the
  // 1080 × 1920 source fits inside the Storybook canvas without
  // sideways scrolling. The preview frame in
  // `ShareCardModal.tsx` uses the same scale.
  args: {
    entry: baseEntry({
      title: 'On Cognitive Sovereignty',
      content:
        'The first principle is that you must not fool yourself — and you are the easiest person to fool. The second is to keep records. The third is to compound the records into a private operating manual.',
      tags: ['#meta', '#discipline', '#first-principles'],
    }),
    options: SHARE_CARD_DEFAULT_OPTIONS,
    displayIdentity: 'Captain Marlow',
    labels,
    scale: 1 / 3,
  },
  argTypes: {
    scale: { control: { type: 'range', min: 0.1, max: 1, step: 0.05 } },
  },
} satisfies Meta<typeof ShareCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — privacy on (body masked), dark theme. */
export const PrivacyDefaultDark: Story = {};

/** Same options, light surface. */
export const PrivacyDefaultLight: Story = {
  args: {
    options: { ...SHARE_CARD_DEFAULT_OPTIONS, theme: 'light' },
  },
  parameters: { backgrounds: { default: 'paper' } },
};

/** User opted in to body disclosure (showBody = true).
 *  Markdown noise (`#`, `**`, code fences) is stripped before
 *  rendering so the excerpt reads as plain text. */
export const BodyRevealedDark: Story = {
  args: {
    options: { ...SHARE_CARD_DEFAULT_OPTIONS, showBody: true },
  },
};

/** Body revealed + light theme. */
export const BodyRevealedLight: Story = {
  args: {
    options: { ...SHARE_CARD_DEFAULT_OPTIONS, showBody: true, theme: 'light' },
  },
  parameters: { backgrounds: { default: 'paper' } },
};

/** Sealed entry — `SEALED` + `TIMELOCK` status flags. */
export const SealedTimelocked: Story = {
  args: {
    entry: lockedEntry({ unlockAt: Date.UTC(2030, 0, 1) }),
    options: SHARE_CARD_DEFAULT_OPTIONS,
  },
};

/** Entry with an attachment + the badge enabled. */
export const WithAttachment: Story = {
  args: {
    entry: baseEntry({
      title: 'Field Sketch — 2025-10-04',
      tags: ['#field-notes'],
      attachment: {
        type: 'image',
        data: 'mock',
        name: 'sunset.png',
        mimeType: 'image/png',
      },
    }),
    options: { ...SHARE_CARD_DEFAULT_OPTIONS, showAttachmentBadge: true },
  },
};

/** Empty-body fallback — entries with no content render the
 *  italic "(no body)" placeholder instead of a masked block. */
export const EmptyBody: Story = {
  args: {
    entry: baseEntry({ content: '' }),
    options: { ...SHARE_CARD_DEFAULT_OPTIONS, showBody: true },
  },
};

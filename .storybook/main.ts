import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Phase 3 §3.b — Storybook 10 (react-vite) configuration.
 *
 * Stories live next to the components they document
 * (`components/<Name>.stories.tsx`) so every story file ships with
 * the component it documents and the existing `*.test.tsx` siblings
 * keep their co-location pattern.
 */
const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
};

export default config;

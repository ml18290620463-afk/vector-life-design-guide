import React from 'react';
import type { Preview } from '@storybook/react-vite';
import { withThemeByClassName } from '@storybook/addon-themes';

import '../index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    backgrounds: {
      default: 'dark',
      values: [
        // The two canonical app surfaces. CoverScreen / Master / Viewer
        // all snap to one of these. Keeping the literals here (rather
        // than `var(--color-…)`) so the chrome looks correct even
        // before our `index.css` finishes loading.
        { name: 'dark', value: '#05070b' },
        { name: 'light', value: '#f0f4f7' },
        { name: 'paper', value: '#faf9f6' },
      ],
    },
    a11y: {
      // Treat every detected violation as a real signal — matches the
      // axe-playwright posture in `e2e/visual.spec.ts`.
      test: 'error',
    },
    layout: 'centered',
  },
  decorators: [
    // App theming is *prop-driven* (every component takes a `theme`
    // prop), so we mainly toggle the body background here. The
    // light / dark class is exposed on `<html>` so any future global
    // selector hooks into the same switch.
    withThemeByClassName({
      themes: {
        dark: 'theme-dark',
        light: 'theme-light',
      },
      defaultTheme: 'dark',
      parentSelector: 'html',
    }),
    (Story, ctx) => {
      const theme = ctx.globals.theme === 'light' ? 'light' : 'dark';
      const bg =
        theme === 'light' ? 'var(--color-vector-fog-light)' : 'var(--color-vector-night-deep)';
      return (
        <div
          data-theme={theme}
          style={{
            minHeight: '100vh',
            background: bg,
            padding: '2rem',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;

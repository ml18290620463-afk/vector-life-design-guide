import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileShell } from './MobileShell';
import type { MobileMainTab } from './types';

const tabs: MobileMainTab[] = ['past', 'now', 'future', 'avatar'];

describe('MobileShell', () => {
  afterEach(cleanup);

  it.each(tabs)('keeps all page-switching entries visible on the %s page', (activeTab) => {
    render(
      <MobileShell activeTab={activeTab} language="en" onTabChange={vi.fn()}>
        <main>Page content</main>
      </MobileShell>,
    );

    const navigation = screen.getByRole('navigation');
    expect(navigation.querySelectorAll('button')).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: new RegExp(activeTab, 'i') }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('requests navigation when a different page entry is selected', () => {
    const onTabChange = vi.fn();
    render(
      <MobileShell activeTab="past" language="en" onTabChange={onTabChange}>
        <main>Past content</main>
      </MobileShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Future' }));

    expect(onTabChange).toHaveBeenCalledWith('future');
  });
});

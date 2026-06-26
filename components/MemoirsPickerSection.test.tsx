import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoirsPickerSection } from './MemoirsPickerSection';
import { TRANSLATIONS } from '../constants';
import { mintPersona } from '../services/personaService';
import type { CustomPersona } from '../types';

const t = TRANSLATIONS.zh;

const memoir = (name: string): CustomPersona =>
  mintPersona({ name, systemPrompt: 'x'.repeat(200), kind: 'memoir' });
const persona = (name: string): CustomPersona =>
  mintPersona({ name, systemPrompt: 'x'.repeat(200), kind: 'persona' });

describe('MemoirsPickerSection', () => {
  afterEach(() => cleanup());

  it('renders nothing when there are no memoirs in the persona list', () => {
    const { container } = render(
      <MemoirsPickerSection
        theme="dark"
        t={t}
        personas={[persona('张三'), persona('李四')]}
        onOpenMemories={vi.fn()}
        onOpenLetters={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per memoir, hiding non-memoir personas', () => {
    const grandma = memoir('奶奶');
    const grandpa = memoir('爷爷');
    render(
      <MemoirsPickerSection
        theme="dark"
        t={t}
        personas={[persona('iSteve'), grandma, persona('Lao Tzu'), grandpa]}
        onOpenMemories={vi.fn()}
        onOpenLetters={vi.fn()}
      />,
    );
    const rows = screen.getAllByTestId(/^settings-memoirs-picker-row-/);
    expect(rows).toHaveLength(2);
    expect(screen.getByText('奶奶')).toBeDefined();
    expect(screen.getByText('爷爷')).toBeDefined();
    // Non-memoirs should NOT appear.
    expect(screen.queryByText('iSteve')).toBeNull();
    expect(screen.queryByText('Lao Tzu')).toBeNull();
  });

  it('clicking the Memories button calls onOpenMemories with the memoir id', () => {
    const grandma = memoir('奶奶');
    const onOpenMemories = vi.fn();
    render(
      <MemoirsPickerSection
        theme="dark"
        t={t}
        personas={[grandma]}
        onOpenMemories={onOpenMemories}
        onOpenLetters={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId(`settings-memoirs-picker-memories-${grandma.id}`));
    expect(onOpenMemories).toHaveBeenCalledWith(grandma.id);
  });

  it('clicking the Letters button calls onOpenLetters with the memoir id', () => {
    const grandma = memoir('奶奶');
    const onOpenLetters = vi.fn();
    render(
      <MemoirsPickerSection
        theme="dark"
        t={t}
        personas={[grandma]}
        onOpenMemories={vi.fn()}
        onOpenLetters={onOpenLetters}
      />,
    );
    fireEvent.click(screen.getByTestId(`settings-memoirs-picker-letters-${grandma.id}`));
    expect(onOpenLetters).toHaveBeenCalledWith(grandma.id);
  });

  it('renders the title + subtitle copy from the dictionary', () => {
    render(
      <MemoirsPickerSection
        theme="light"
        t={t}
        personas={[memoir('奶奶')]}
        onOpenMemories={vi.fn()}
        onOpenLetters={vi.fn()}
      />,
    );
    expect(screen.getByText(t.memoirsPickerTitle as string)).toBeDefined();
    expect(screen.getByText(t.memoirsPickerSubtitle as string)).toBeDefined();
  });
});

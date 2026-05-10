import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Editor } from './Editor';
import { clearEditorDraft } from '../services/editorDraft';

/**
 * Phase 4.5 follow-ups (F4) — focused tests for the new `seed`
 * prop. We don't try to cover the full Editor surface (which is
 * already validated by the wider integration suite); only the
 * seed-restore behaviour added in this sprint.
 */

const baseProps = {
  language: 'zh' as const,
  theme: 'dark' as const,
  masterPassword: null,
  onSave: vi.fn(),
  onCancel: vi.fn(),
  existingTitles: [] as string[],
};

describe('Editor — Phase 4.5 F4 seed prop', () => {
  afterEach(async () => {
    cleanup();
    // Defensive — make sure stale drafts from previous tests don't
    // poison the seed-restore path.
    await clearEditorDraft();
  });

  it('applies the seed when no draft exists', async () => {
    const seed = {
      title: '写给奶奶',
      content: '想跟你说一件事...',
      tags: '奶奶',
    };
    render(<Editor {...baseProps} seed={seed} />);
    await waitFor(() => {
      expect((screen.getByDisplayValue('写给奶奶') as HTMLInputElement).value).toBe('写给奶奶');
    });
    // Content lives in a textarea; we can find it by displayed value.
    expect((screen.getByDisplayValue('想跟你说一件事...') as HTMLTextAreaElement).value).toBe(
      '想跟你说一件事...',
    );
  });

  it('omits seed.title when seed.title is undefined (renders empty title)', async () => {
    const seed = { content: 'just content', tags: '' };
    render(<Editor {...baseProps} seed={seed} />);
    await waitFor(() => {
      expect((screen.getByDisplayValue('just content') as HTMLTextAreaElement).value).toBe(
        'just content',
      );
    });
    // Title input should still exist but be empty.
    const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });

  it('skips seed entirely when seed prop is null (legacy behaviour)', async () => {
    render(<Editor {...baseProps} seed={null} />);
    await waitFor(() => {
      const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      // Title is empty since no draft + no seed.
      expect(titleInput.value).toBe('');
    });
  });

  it('skips seed entirely when seed prop is omitted', async () => {
    render(<Editor {...baseProps} />);
    await waitFor(() => {
      const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      expect(titleInput.value).toBe('');
    });
  });
});

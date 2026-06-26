import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryManagementPanel } from './MemoryManagementPanel';
import { TRANSLATIONS } from '../constants';
import { mintPersona } from '../services/personaService';
import type { Memory } from '../types';

const t = TRANSLATIONS.zh;

const memoir = mintPersona({
  name: '奶奶',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});

const sampleMemories = (): Memory[] => [
  {
    id: 'memory-1',
    memoirId: memoir.id,
    category: 'milestone',
    body: '今天是奶奶的忌日',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  {
    id: 'memory-2',
    memoirId: memoir.id,
    category: 'fact',
    body: '用户上周面试通过了',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
];

describe('MemoryManagementPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the safety reminder card on every render', () => {
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByText(t.memoryPanelSafetyTitle as string)).toBeDefined();
    expect(screen.getByText(t.memoryPanelSafetyBody as string)).toBeDefined();
  });

  it('renders an empty state when there are no memories', () => {
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={[]}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByText(t.memoryPanelEmpty as string)).toBeDefined();
  });

  it('groups memories by category and renders them all', () => {
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByText('今天是奶奶的忌日')).toBeDefined();
    expect(screen.getByText('用户上周面试通过了')).toBeDefined();
    expect(screen.getByText(t.memoryCategoryMilestone as string)).toBeDefined();
    expect(screen.getByText(t.memoryCategoryFact as string)).toBeDefined();
  });

  it('delete fires onDeleteMemory with the memory id', () => {
    const onDelete = vi.fn();
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={onDelete}
        onClearAll={vi.fn()}
      />,
    );
    const deleteButtons = screen.getAllByLabelText(/删除 \(memory-/);
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith('memory-1');
  });

  it('edit → safety check rejects bodies with PII', async () => {
    const onUpdate = vi.fn();
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={onUpdate}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    const editButtons = screen.getAllByLabelText(/编辑 \(memory-/);
    fireEvent.click(editButtons[0]);

    const editor = screen.getByLabelText(t.memoryEditAria as string) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '新的内容 联系 13800138000' } });

    const save = screen.getByLabelText(t.memoryEditSave as string);
    fireEvent.click(save);

    await waitFor(() => {
      expect(screen.getByText(/private contact info|个人联系信息/)).toBeDefined();
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('edit → save persists when the body passes the safety check', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={onUpdate}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    const editButtons = screen.getAllByLabelText(/编辑 \(memory-/);
    fireEvent.click(editButtons[0]);

    const editor = screen.getByLabelText(t.memoryEditAria as string) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '编辑后的安全内容' } });

    const save = screen.getByLabelText(t.memoryEditSave as string);
    fireEvent.click(save);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('memory-1', { body: '编辑后的安全内容' });
    });
  });

  it('clear-all requires two taps within 5 seconds', () => {
    const onClearAll = vi.fn();
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={onClearAll}
      />,
    );
    const clear = screen.getByLabelText(t.memoryClearAllAria as string);
    fireEvent.click(clear);
    expect(onClearAll).not.toHaveBeenCalled();
    // Second click within 5s → fires.
    fireEvent.click(clear);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  /* -------------------------------------------------------------- */
  /*  Phase 4 W4 — capacity chip + salience badges + recycle bin    */
  /* -------------------------------------------------------------- */

  it('renders the capacity chip when capacity prop is supplied', () => {
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
        capacity={200}
      />,
    );
    const chip = screen.getByTestId('memory-capacity-chip');
    expect(chip.textContent).toContain('2');
    expect(chip.textContent).toContain('200');
  });

  it('does NOT render the capacity chip when capacity is omitted (legacy callers)', () => {
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('memory-capacity-chip')).toBeNull();
  });

  it('renders a salience badge per memory row', () => {
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    // Two memories → at least two salience badges (any tier).
    const badges = screen.queryAllByTestId(/^salience-badge-/);
    expect(badges.length).toBe(2);
  });

  it('shows recycle-bin tab + view when recycleBin handlers are wired', () => {
    const recycleBin: Memory[] = [
      {
        id: 'memory-deleted-1',
        memoirId: memoir.id,
        category: 'fact',
        body: '已删除的旧记忆',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        deletedAt: 1_700_000_001_000,
      },
    ];
    const onRestoreMemory = vi.fn();
    const onHardDeleteMemory = vi.fn();
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
        recycleBin={recycleBin}
        onRestoreMemory={onRestoreMemory}
        onHardDeleteMemory={onHardDeleteMemory}
      />,
    );

    // Tabs are visible.
    expect(screen.getByRole('tab', { selected: true }).textContent).toMatch(/Live|当前/);
    const recycleTab = screen.getAllByRole('tab').find((b) => b.textContent?.match(/Recycle|回收/));
    expect(recycleTab).toBeDefined();
    fireEvent.click(recycleTab!);

    // Now in recycle view: deleted memory body shown, live ones hidden.
    expect(screen.getByText('已删除的旧记忆')).toBeDefined();
    expect(screen.queryByText('用户上周面试通过了')).toBeNull();

    // Restore + hard-delete fire correct callbacks.
    fireEvent.click(screen.getByLabelText(/恢复 \(memory-deleted-1\)/));
    expect(onRestoreMemory).toHaveBeenCalledWith('memory-deleted-1');
    fireEvent.click(screen.getByLabelText(/彻底删除 \(memory-deleted-1\)/));
    expect(onHardDeleteMemory).toHaveBeenCalledWith('memory-deleted-1');
  });

  it('hides the recycle-bin tab when no handlers / no deleted entries', () => {
    render(
      <MemoryManagementPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        memories={sampleMemories()}
        onUpdateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  /* -------------------------------------------------------------- *
   * Phase 4.5 follow-ups (F2) — cascade-delete-memoir CTA           *
   * -------------------------------------------------------------- */

  describe('Phase 4.5 F2 — cascade delete', () => {
    it('hides the cascade footer when onCascadeDeleteMemoir is omitted', () => {
      render(
        <MemoryManagementPanel
          open
          onClose={vi.fn()}
          theme="dark"
          t={t}
          memoir={memoir}
          memories={sampleMemories()}
          onUpdateMemory={vi.fn()}
          onDeleteMemory={vi.fn()}
          onClearAll={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('memory-panel-cascade-delete')).toBeNull();
    });

    it('shows the cascade footer when onCascadeDeleteMemoir is wired', () => {
      render(
        <MemoryManagementPanel
          open
          onClose={vi.fn()}
          theme="dark"
          t={t}
          memoir={memoir}
          memories={sampleMemories()}
          onUpdateMemory={vi.fn()}
          onDeleteMemory={vi.fn()}
          onClearAll={vi.fn()}
          onCascadeDeleteMemoir={vi.fn()}
        />,
      );
      expect(screen.getByTestId('memory-panel-cascade-delete')).toBeDefined();
      expect(screen.getByText(t.memoryCascadeDelete as string)).toBeDefined();
    });

    it('first click arms; second click within 5s fires the cascade + closes', async () => {
      const onCascadeDeleteMemoir = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      render(
        <MemoryManagementPanel
          open
          onClose={onClose}
          theme="dark"
          t={t}
          memoir={memoir}
          memories={sampleMemories()}
          onUpdateMemory={vi.fn()}
          onDeleteMemory={vi.fn()}
          onClearAll={vi.fn()}
          onCascadeDeleteMemoir={onCascadeDeleteMemoir}
        />,
      );
      const btn = screen.getByText(t.memoryCascadeDelete as string);
      fireEvent.click(btn);
      // After arm, the label flips to the confirm copy.
      await waitFor(() => {
        expect(screen.getByText(t.memoryCascadeDeleteConfirm as string)).toBeDefined();
      });
      // Second click fires.
      fireEvent.click(screen.getByText(t.memoryCascadeDeleteConfirm as string));
      expect(onCascadeDeleteMemoir).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

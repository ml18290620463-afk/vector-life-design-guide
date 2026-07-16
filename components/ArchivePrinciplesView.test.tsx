import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArchivePrinciplesView } from './ArchivePrinciplesView';
import { TRANSLATIONS } from '../constants';
import type { Principle } from '../types';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  principles: [] as Principle[],
  onAddPrinciple: vi.fn(),
  onDeletePrinciple: vi.fn(),
  onUpdatePrinciple: vi.fn(),
};

describe('ArchivePrinciplesView', () => {
  it('renders the empty state when there are no persisted principles', () => {
    render(<ArchivePrinciplesView {...baseProps} />);
    expect(screen.getByText(t.noPrinciples)).toBeTruthy();
  });

  it('typing into the textarea routes through the controlled input', () => {
    render(<ArchivePrinciplesView {...baseProps} />);
    const textarea = screen.getByLabelText(t.addPrinciple) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Be water' } });
    expect(textarea.value).toBe('Be water');
  });

  it('truncates input at 30 chars and surfaces the warning role="alert"', () => {
    render(<ArchivePrinciplesView {...baseProps} />);
    const textarea = screen.getByLabelText(t.addPrinciple) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'A'.repeat(40) } });
    expect(textarea.value.length).toBe(30);
    expect(screen.getByRole('alert').textContent).toContain(t.charLimitWarning);
  });

  it('clicking add with empty input does NOT call onAddPrinciple', () => {
    const onAddPrinciple = vi.fn();
    render(<ArchivePrinciplesView {...baseProps} onAddPrinciple={onAddPrinciple} />);
    // The label and the submit button share the same localised string;
    // pick the actual <button>.
    const button = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.addPrinciple));
    expect(button).toBeTruthy();
    fireEvent.click(button!);
    expect(onAddPrinciple).not.toHaveBeenCalled();
  });

  it('clicking add with a non-empty input fires onAddPrinciple with text + year + showOnHome', () => {
    const onAddPrinciple = vi.fn();
    render(<ArchivePrinciplesView {...baseProps} onAddPrinciple={onAddPrinciple} />);
    fireEvent.change(screen.getByLabelText(t.addPrinciple), {
      target: { value: 'Be water, friend' },
    });
    const button = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.addPrinciple));
    fireEvent.click(button!);
    expect(onAddPrinciple).toHaveBeenCalledTimes(1);
    const [text, year, showOnHome] = onAddPrinciple.mock.calls[0];
    expect(text).toBe('Be water, friend');
    expect(typeof year).toBe('number');
    expect(showOnHome).toBe(true);
  });

  it('persists an optional trigger-to-action application when both fields are present', () => {
    const onAddPrinciple = vi.fn();
    render(<ArchivePrinciplesView {...baseProps} language="zh" onAddPrinciple={onAddPrinciple} />);
    fireEvent.change(screen.getByLabelText(t.addPrinciple), { target: { value: '沟通前先对齐' } });
    fireEvent.change(screen.getByLabelText('触发场景（可选）'), {
      target: { value: '重要沟通开始前' },
    });
    fireEvent.change(screen.getByLabelText('对应动作（可选）'), {
      target: { value: '写下唯一目标' },
    });
    fireEvent.click(screen.getAllByRole('button').find((button) => button.textContent?.includes(t.addPrinciple))!);
    expect(onAddPrinciple).toHaveBeenCalledWith(
      '沟通前先对齐',
      expect.any(Number),
      true,
      undefined,
      { trigger: '重要沟通开始前', action: '写下唯一目标' },
    );
  });

  it('renders a structured principle as a when-do pair', () => {
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        principles={[
          {
            id: 'structured', text: '沟通前先对齐', year: 2026, createdAt: 1, showOnHome: true,
            application: { trigger: '重要沟通开始前', action: '写下唯一目标' },
          },
        ]}
      />,
    );
    expect(screen.getByText('重要沟通开始前')).toBeTruthy();
    expect(screen.getByText('写下唯一目标')).toBeTruthy();
  });

  it('renders persisted principles grouped by year (descending)', () => {
    const principles: Principle[] = [
      { id: 'p1', text: 'Older', year: 2023, createdAt: 1, showOnHome: true },
      { id: 'p2', text: 'Newer', year: 2025, createdAt: 2, showOnHome: false },
    ];
    render(<ArchivePrinciplesView {...baseProps} principles={principles} />);
    expect(screen.getByText('Older')).toBeTruthy();
    expect(screen.getByText('Newer')).toBeTruthy();
    // Year separators carry the "formed through {year}" label.
    expect(screen.getByText(t.formedThrough.replace('{year}', '2025'))).toBeTruthy();
  });

  it('toggling the show-on-home star fires onUpdatePrinciple with the flipped flag', () => {
    const onUpdatePrinciple = vi.fn();
    const principles: Principle[] = [
      { id: 'p1', text: 'Pin me', year: 2025, createdAt: 1, showOnHome: false },
    ];
    render(
      <ArchivePrinciplesView
        {...baseProps}
        principles={principles}
        onUpdatePrinciple={onUpdatePrinciple}
      />,
    );
    fireEvent.click(screen.getAllByLabelText(t.showOnHome)[1]); // [0] is the form's checkbox.
    expect(onUpdatePrinciple).toHaveBeenCalledWith({
      id: 'p1',
      text: 'Pin me',
      year: 2025,
      createdAt: 1,
      showOnHome: true,
    });
  });
});

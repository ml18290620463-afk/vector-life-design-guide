import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { FutureEditor } from './FutureEditor';
import type { FutureState } from '../../types/future';
const state = {
  schemaVersion: 1,
  revision: 0,
  visions: [],
  goals: [],
  items: [],
  events: [],
  revisions: [],
  closures: [],
  receipts: [],
} satisfies FutureState;
beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn());
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const mount = (busy = false) => {
  const close = vi.fn();
  const change = vi.fn();
  const submit = vi.fn(() => false);
  render(
    <FutureEditor
      editor={{ kind: 'vision' }}
      state={state}
      opener={null}
      close={close}
      busy={busy}
      notice=""
      submit={submit}
      onKindChange={change}
    />,
  );
  return { close, change, submit };
};
describe('Future editor content protection', () => {
  it('closes untouched content without asking', () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { close } = mount();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(close).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
  it('preserves changed text on cancelled back, Escape and kind switch', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { close, change } = mount();
    const field = screen.getByLabelText('愿景内容');
    fireEvent.change(field, { target: { value: '想要留下的愿景' } });
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    fireEvent.click(screen.getByRole('tab', { name: '目标' }));
    expect(close).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
    expect((field as HTMLTextAreaElement).value).toBe('想要留下的愿景');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
  it('allows leaving with a draft and submits from the header without a discard prompt', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { close, submit } = mount();
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('愿景内容'), { target: { value: '新的愿景' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(close).toHaveBeenCalledOnce();
  });
  it('locks controls while saving', () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { close } = mount(true);
    expect((screen.getByRole('button', { name: '保存中…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(close).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
  it('recognizes reverted text as clean', () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { close } = mount();
    fireEvent.change(screen.getByLabelText('愿景内容'), { target: { value: '临时文字' } });
    fireEvent.change(screen.getByLabelText('愿景内容'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(close).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
});

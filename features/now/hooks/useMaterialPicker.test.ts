import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMaterialPicker } from './useMaterialPicker';

const image = () => new File(['image'], 'photo.png', { type: 'image/png' });
function setup() {
  const readers: FileReader[] = [];
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
    readers.push(this);
  });
  const onAdd = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(() => useMaterialPicker({ materials: [], onAdd, onError }));
  const finish = (reader: FileReader) => {
    Object.defineProperty(reader, 'result', { value: 'data:image/png;base64,aA==' });
    reader.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
  };
  return { ...hook, readers, onAdd, onError, finish };
}
afterEach(() => vi.restoreAllMocks());
describe('material import integrity', () => {
  it('protects a pending file-only input from refresh until reading completes', async () => {
    const h = setup();
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.addFiles([image()]);
    });
    const during = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);
    await act(async () => {
      h.finish(h.readers[0]);
      await pending;
    });
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    h.unmount();
  });
  it('locks concurrent imports and commits a complete batch only after all reads', async () => {
    const h = setup();
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.addFiles([image(), image()]);
    });
    expect(h.result.current.reading).toBe(true);
    await act(async () => {
      await h.result.current.addFiles([image()]);
    });
    expect(h.readers).toHaveLength(2);
    await act(async () => {
      h.finish(h.readers[0]);
    });
    expect(h.onAdd).not.toHaveBeenCalled();
    await act(async () => {
      h.finish(h.readers[1]);
      await pending;
    });
    expect(h.onAdd.mock.calls[0][0]).toHaveLength(2);
    expect(h.result.current.reading).toBe(false);
  });
  it('never appends late results after leaving the editor', async () => {
    const h = setup();
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.addFiles([image()]);
    });
    h.unmount();
    await act(async () => {
      h.finish(h.readers[0]);
      await pending;
    });
    expect(h.onAdd).not.toHaveBeenCalled();
  });
  it('does not silently truncate an oversized selection', async () => {
    const h = setup();
    await act(async () => {
      await h.result.current.addFiles(Array.from({ length: 9 }, image));
    });
    expect(h.onError).toHaveBeenCalledWith('图片最多 8 张');
    expect(h.readers).toHaveLength(0);
    expect(h.onAdd).not.toHaveBeenCalled();
  });
  it('retains successful files and retries only the failed file', async () => {
    const h = setup();
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.addFiles([image(), image()]);
    });
    await act(async () => {
      h.finish(h.readers[0]);
      h.readers[1].onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
      await pending;
    });
    expect(h.onAdd.mock.calls[0][0]).toHaveLength(1);
    expect(h.result.current.failures).toHaveLength(1);
    const during = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);
    act(() => {
      pending = h.result.current.retryFailure(h.result.current.failures[0].id);
    });
    await act(async () => {
      h.readers[2].onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
      await pending;
    });
    expect(h.result.current.failures).toHaveLength(1);
    act(() => {
      pending = h.result.current.retryFailure(h.result.current.failures[0].id);
    });
    await act(async () => {
      h.finish(h.readers[3]);
      await pending;
    });
    expect(h.result.current.failures).toHaveLength(0);
    expect(h.onAdd).toHaveBeenCalledTimes(2);
  });
  it('adds nothing on read failure and permits a retry', async () => {
    const h = setup();
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.addFiles([image()]);
    });
    await act(async () => {
      h.readers[0].onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
      await pending;
    });
    expect(h.onAdd).not.toHaveBeenCalled();
    expect(h.result.current.reading).toBe(false);
    act(() => {
      pending = h.result.current.addFiles([image()]);
    });
    await act(async () => {
      h.finish(h.readers[1]);
      await pending;
    });
    expect(h.onAdd).toHaveBeenCalledOnce();
  });
});

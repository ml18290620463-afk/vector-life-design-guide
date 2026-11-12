import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { serviceWorkerStatus } from '../lib/pwaRegister';
import { AppUpdateNotice } from './AppUpdateNotice';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('does not interrupt the page when no update is available', () => {
  render(<AppUpdateNotice />);
  expect(screen.queryByLabelText('版本更新')).toBeNull();
});
it('requires explicit confirmation before reloading a writing session', async () => {
  vi.spyOn(serviceWorkerStatus, 'isUpdateAvailable').mockReturnValue(true);
  const apply = vi.spyOn(serviceWorkerStatus, 'applyUpdate').mockResolvedValue();
  const confirm = vi.fn().mockReturnValue(false);
  vi.stubGlobal('confirm', confirm);
  render(<AppUpdateNotice />);
  fireEvent.click(screen.getByText('保存好了，更新'));
  expect(apply).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByText('保存好了，更新'));
  await waitFor(() => expect(apply).toHaveBeenCalledOnce());
});
it('preserves a retry path if updating fails', async () => {
  vi.spyOn(serviceWorkerStatus, 'isUpdateAvailable').mockReturnValue(true);
  vi.spyOn(serviceWorkerStatus, 'applyUpdate').mockRejectedValue(new Error('offline'));
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  render(<AppUpdateNotice />);
  fireEvent.click(screen.getByText('保存好了，更新'));
  expect((await screen.findByRole('alert')).textContent).toContain('更新失败');
  expect((screen.getByText('保存好了，更新') as HTMLButtonElement).disabled).toBe(false);
});

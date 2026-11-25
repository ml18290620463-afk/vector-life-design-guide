import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarReliabilityAssistant } from './AvatarReliabilityAssistant';

const mocks = vi.hoisted(() => ({
  inspect: vi.fn(),
  decrypt: vi.fn(),
  restore: vi.fn(),
  drill: vi.fn(),
}));
vi.mock('../../../stores/appStore', () => ({
  useAppStore: () => ({ isUnlocked: true, masterPassword: 'target-key', userId: 'account' }),
}));
vi.mock('../../../services/vaultBackupInspection', () => ({ inspectVaultBackup: mocks.inspect }));
vi.mock('../../../services/vaultBackupFile', () => ({
  isEncryptedVaultBackup: () => true,
  decryptVaultBackupFile: mocks.decrypt,
}));
vi.mock('../../../services/vaultBackup', () => ({
  importVaultBackup: mocks.restore,
  drillVaultBackupRestore: mocks.drill,
  exportVaultBackupFile: vi.fn(),
  exportRecoverableVaultBackupFile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inspect.mockResolvedValue({ needsPassword: false });
  mocks.decrypt.mockResolvedValue({ schemaVersion: 3, vault: {} });
  mocks.drill.mockResolvedValue({
    canRestore: true,
    importedCount: 0,
    totalAfter: 0,
    conflicts: [],
  });
  mocks.restore.mockResolvedValue({ mode: 'merge', importedCount: 0, restored: {} });
});
afterEach(cleanup);

describe('backup source password propagation', () => {
  it.each(['', 'source-key'])(
    'uses the same key through inspection, drill and restore (%s)',
    async (sourcePassword) => {
      const { container } = render(
        <AvatarReliabilityAssistant
          task="backup"
          draft={{
            text: '',
            materials: [],
            mood_tags: [],
            event_tags: [],
            record_time: '',
            display_time: '',
            updated_at: '',
          }}
          onOpenDraft={vi.fn()}
          showToast={vi.fn()}
        />,
      );
      const file = new File(['{}'], 'backup.json', { type: 'application/json' });
      fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } });
      if (sourcePassword)
        fireEvent.change(screen.getByLabelText('备份密令'), { target: { value: sourcePassword } });
      const key = sourcePassword || 'target-key';
      fireEvent.click(screen.getByRole('button', { name: '检查备份' }));
      await waitFor(() => expect(mocks.inspect).toHaveBeenCalledWith({}, key));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '隔离恢复演练' })).not.toBeDisabled(),
      );
      fireEvent.click(screen.getByRole('button', { name: '隔离恢复演练' }));
      await waitFor(() =>
        expect(mocks.drill).toHaveBeenCalledWith(
          { schemaVersion: 3, vault: {} },
          'merge',
          'account',
          key,
        ),
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '合并恢复' })).not.toBeDisabled(),
      );
      // Neither inspection nor the isolated drill may commit data.
      expect(mocks.restore).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '合并恢复' }));
      await waitFor(() =>
        expect(mocks.restore).toHaveBeenCalledWith(
          { schemaVersion: 3, vault: {} },
          'merge',
          'account',
          key,
          false,
        ),
      );
      expect(mocks.decrypt).toHaveBeenCalledTimes(2);
      expect(mocks.decrypt).toHaveBeenNthCalledWith(1, {}, key);
      expect(mocks.decrypt).toHaveBeenNthCalledWith(2, {}, key);
    },
  );
});

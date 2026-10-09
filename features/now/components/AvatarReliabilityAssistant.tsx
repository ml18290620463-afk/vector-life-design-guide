import React, { useRef, useState } from 'react';
import type { NowDraft } from '../types/now';
import type { AvatarReliabilityTask } from '../state/avatarReliabilityTasks';
import { useAppStore } from '../../../stores/appStore';
import {
  exportVaultBackupFile,
  importVaultBackup,
  type VaultBackup,
} from '../../../services/vaultBackup';
import { decryptVaultBackupFile, isEncryptedVaultBackup } from '../../../services/vaultBackupFile';
import { downloadTextFile } from '../../../services/fileDownload';

interface Props {
  task: AvatarReliabilityTask;
  draft: NowDraft;
  onOpenDraft: () => void;
  showToast: (message: string) => void;
}

const hasDraftContent = (draft: NowDraft) =>
  Boolean(
    draft.text.trim() ||
    draft.materials.length ||
    draft.mood_tags.length ||
    draft.event_tags.length,
  );

export function AvatarReliabilityAssistant({ task, draft, onOpenDraft, showToast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isUnlocked, masterPassword, userId } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [error, setError] = useState('');

  const exportBackup = async () => {
    setBusy(true);
    setError('');
    try {
      const backup = await exportVaultBackupFile('1.1.0', userId);
      const date = new Date().toISOString().slice(0, 10);
      await downloadTextFile(
        JSON.stringify(backup),
        `vector-backup-${date}.json`,
        'application/json',
      );
      showToast(isUnlocked ? '已生成加密备份文件' : '已生成备份文件');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成备份失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async () => {
    if (!restoreFile || busy) return;
    if (restoreMode === 'replace' && !replaceConfirmed) {
      setError('请确认替换会覆盖本机资料后再继续。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const raw: unknown = JSON.parse(await restoreFile.text());
      const backup = isEncryptedVaultBackup(raw)
        ? await decryptVaultBackupFile(raw, restorePassword || masterPassword || '')
        : raw;
      const summary = await importVaultBackup(
        backup as VaultBackup,
        restoreMode,
        userId,
        restorePassword || undefined,
      );
      setRestoreFile(null);
      setRestorePassword('');
      setReplaceConfirmed(false);
      showToast(`已${restoreMode === 'merge' ? '合并' : '恢复'} ${summary.importedCount} 条记录`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '恢复失败，请检查备份文件后重试');
    } finally {
      setBusy(false);
    }
  };

  if (task === 'draft') {
    const available = hasDraftContent(draft);
    return (
      <aside className="avatar-reliability-card" aria-label="草稿协助">
        <span className="avatar-reliability-card__eyebrow">未完成记录</span>
        <p>
          {available
            ? '发现一份本机草稿。回到“现在”即可继续编辑，内容会留在原处。'
            : '这台设备目前没有可继续编辑的草稿。新的记录会自动保存为草稿。'}
        </p>
        {available && (
          <button type="button" onClick={onOpenDraft}>
            继续这份草稿
          </button>
        )}
      </aside>
    );
  }

  if (task === 'security') {
    const protectedVault = Boolean(isUnlocked && masterPassword);
    return (
      <aside className="avatar-reliability-card" aria-label="数据保护状态">
        <span className="avatar-reliability-card__eyebrow">资料保护</span>
        <p>
          {protectedVault
            ? '此资料库已解锁并使用本地加密保护。分身只能确认保护状态，不会读取或显示你的密令。'
            : '此会话尚未解锁加密资料库。加密功能会在创建或解锁资料库时启用。'}
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="avatar-reliability-card avatar-reliability-card--backup"
      aria-label="备份与恢复"
    >
      <span className="avatar-reliability-card__eyebrow">备份与恢复</span>
      <p>备份会包含记录、目标、分身档案和未完成草稿。已启用本地加密时，导出的文件也会加密。</p>
      <p>恢复凭证用于找回访问权限，不包含日记资料。请另存数据备份，并保管好备份时使用的密令。</p>
      <div className="avatar-reliability-card__actions">
        <button type="button" onClick={() => void exportBackup()} disabled={busy}>
          生成备份
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          选择备份文件
        </button>
      </div>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          setRestoreFile(event.target.files?.[0] ?? null);
          setError('');
          event.currentTarget.value = '';
        }}
      />
      {restoreFile && (
        <div className="avatar-reliability-restore">
          <p>已选择：{restoreFile.name}</p>
          <label>
            <input
              type="radio"
              checked={restoreMode === 'merge'}
              onChange={() => setRestoreMode('merge')}
            />
            合并到本机（保留现有资料）
          </label>
          <label>
            <input
              type="radio"
              checked={restoreMode === 'replace'}
              onChange={() => setRestoreMode('replace')}
            />
            用备份替换本机资料
          </label>
          <input
            value={restorePassword}
            onChange={(event) => setRestorePassword(event.target.value)}
            type="password"
            autoComplete="off"
            placeholder="若备份已加密，请输入备份密令"
            aria-label="备份密令"
          />
          {restoreMode === 'replace' && (
            <label className="avatar-reliability-restore__confirm">
              <input
                type="checkbox"
                checked={replaceConfirmed}
                onChange={(event) => setReplaceConfirmed(event.target.checked)}
              />
              我确认替换会覆盖这台设备上的资料
            </label>
          )}
          <button
            type="button"
            onClick={() => void restoreBackup()}
            disabled={busy || (restoreMode === 'replace' && !replaceConfirmed)}
          >
            {busy ? '处理中…' : restoreMode === 'merge' ? '合并恢复' : '替换恢复'}
          </button>
        </div>
      )}
      {error && (
        <p className="avatar-reliability-card__error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}

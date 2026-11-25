import { accountLocalStorage } from '../../../services/accountScope';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NowDraft } from '../types/now';
import type { AvatarReliabilityTask } from '../state/avatarReliabilityTasks';
import { useAppStore } from '../../../stores/appStore';
import {
  exportVaultBackupFile,
  exportRecoverableVaultBackupFile,
  drillVaultBackupRestore,
  importVaultBackup,
  type VaultRecoveryDrill,
  type VaultBackup,
} from '../../../services/vaultBackup';
import { decryptVaultBackupFile, isEncryptedVaultBackup } from '../../../services/vaultBackupFile';
import { downloadTextFile } from '../../../services/fileDownload';
import {
  inspectVaultBackup,
  type VaultBackupInspection,
} from '../../../services/vaultBackupInspection';
import type { VaultBackupContentSummary } from '../../../services/vaultBackupSummary';

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
  const statusKey = `vector:backup-status:v1:${userId ?? 'local'}`;
  const readStatus = useCallback(() => {
    try {
      const value = JSON.parse(accountLocalStorage.getItem(statusKey) || '{}');
      if (!value || typeof value !== 'object') return {};
      return {
        generatedAt:
          Number.isFinite(value.generatedAt) && value.generatedAt > 0
            ? (value.generatedAt as number)
            : undefined,
        drilledAt:
          Number.isFinite(value.drilledAt) && value.drilledAt > 0
            ? (value.drilledAt as number)
            : undefined,
        canRestore:
          typeof value.canRestore === 'boolean' ? (value.canRestore as boolean) : undefined,
      };
    } catch {
      return {};
    }
  }, [statusKey]);
  const [backupStatus, setBackupStatus] = useState<{
    generatedAt?: number;
    drilledAt?: number;
    canRestore?: boolean;
  }>(readStatus);
  useEffect(() => {
    setBackupStatus(readStatus());
  }, [readStatus]);
  const remember = (patch: typeof backupStatus) => {
    const next = { ...backupStatus, ...patch };
    setBackupStatus(next);
    try {
      accountLocalStorage.setItem(statusKey, JSON.stringify(next));
    } catch {
      /* Status is advisory; the file operation remains valid. */
    }
  };
  const [reminderHidden, setReminderHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [resurrectionConfirmed, setResurrectionConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [inspection, setInspection] = useState<VaultBackupInspection | null>(null);
  const [drill, setDrill] = useState<VaultRecoveryDrill | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    mode: 'merge' | 'replace';
    restored: VaultBackupContentSummary;
  } | null>(null);

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
      remember({ generatedAt: Date.now() });
      showToast(isUnlocked ? '已生成加密备份文件' : '已生成备份文件');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成备份失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const exportRecoverableBackup = async () => {
    setBusy(true);
    setError('');
    try {
      const { file, skippedEntries } = await exportRecoverableVaultBackupFile('1.1.0', userId);
      if (!skippedEntries.length) {
        setError('当前没有无法读取的记录，请使用普通备份。');
        return;
      }
      await downloadTextFile(
        JSON.stringify(file),
        `vector-recovery-backup-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
      );
      showToast(`已生成可抢救备份，跳过 ${skippedEntries.length} 条无法读取的记录`);
      setError(
        `未写入或修改当前资料库。未包含：${skippedEntries.map((entry) => `${entry.id}（${entry.reason}）`).join('；')}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成可抢救备份失败');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async () => {
    if (!restoreFile || busy) return;
    if (!inspection || inspection.needsPassword) {
      setError('请先检查备份内容后再恢复。');
      return;
    }
    if (restoreMode === 'replace' && !replaceConfirmed) {
      setError('请确认替换会使资料回到备份创建时刻。');
      return;
    }
    if (drill?.resurrectionCount && !resurrectionConfirmed) {
      setError('旧备份包含删除后留下的记录，请先查看演练结果并明确确认。');
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
        restorePassword || masterPassword || undefined,
        resurrectionConfirmed,
      );
      setRestoreFile(null);
      setRestorePassword('');
      setReplaceConfirmed(false);
      setResurrectionConfirmed(false);
      setInspection(null);
      setDrill(null);
      setRestoreResult({ mode: summary.mode, restored: summary.restored });
      showToast(`已${restoreMode === 'merge' ? '合并' : '恢复'} ${summary.importedCount} 条记录`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '恢复失败，请检查备份文件后重试');
    } finally {
      setBusy(false);
    }
  };

  const inspectBackup = async () => {
    if (!restoreFile || busy) return;
    setBusy(true);
    setError('');
    setInspection(null);
    try {
      setInspection(
        await inspectVaultBackup(
          JSON.parse(await restoreFile.text()),
          restorePassword || masterPassword || '',
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '检查失败，请确认备份文件或密令');
    } finally {
      setBusy(false);
    }
  };

  const drillRestore = async () => {
    if (!restoreFile || busy) return;
    setBusy(true);
    setError('');
    setDrill(null);
    try {
      const raw: unknown = JSON.parse(await restoreFile.text());
      const backup = isEncryptedVaultBackup(raw)
        ? await decryptVaultBackupFile(raw, restorePassword || masterPassword || '')
        : raw;
      const result = await drillVaultBackupRestore(
        backup as VaultBackup,
        restoreMode,
        userId,
        restorePassword || masterPassword || undefined,
      );
      setDrill(result);
      setResurrectionConfirmed(false);
      remember({ drilledAt: Date.now(), canRestore: result.canRestore });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '演练失败，请检查备份文件或密令');
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
      <p>资料保存在当前设备的浏览器中，不会自动同步到其他设备。</p>
      <div role="status">
        <p>
          {backupStatus.generatedAt
            ? `最近生成完整备份：${new Date(backupStatus.generatedAt).toLocaleString()}`
            : '尚无本机完整备份生成记录。'}
        </p>
        <p>
          {backupStatus.drilledAt
            ? `最近对所选文件的演练：${new Date(backupStatus.drilledAt).toLocaleString()} · ${backupStatus.canRestore ? '可恢复' : '存在冲突'}`
            : '尚无所选文件的恢复演练记录。'}
        </p>
        <p>
          生成记录不能确认文件已妥善保存；演练只验证当次所选文件，不代表最新备份已验证，也不代表已完成实际恢复。
        </p>
        {!reminderHidden &&
          (!backupStatus.generatedAt || Date.now() - backupStatus.generatedAt > 7 * 86400000) && (
            <div>
              <p>建议生成一份近期备份，另存后选择该文件进行恢复演练。</p>
              <button type="button" onClick={() => setReminderHidden(true)}>
                本次不再提醒
              </button>
            </div>
          )}
      </div>
      <details className="avatar-reliability-card__recovery">
        <summary>什么时候备份？如何换设备？</summary>
        <p>
          记录重要内容后，以及清理浏览器数据、更换浏览器或设备前，请生成备份，并把文件另存到可靠的位置。
        </p>
        <p>
          备份包含记录、原则、规划、已确认记忆和草稿。网页链接只保存地址，不能保证恢复链接中的内容。
        </p>
        <p>
          在新设备打开 VECTOR，进入「分身 →
          备份」，选择「恢复备份」，输入创建备份时的密令，检查后选择「合并恢复」。资料不会自动在两台设备之间更新。
        </p>
        <p>
          请妥善保存备份文件和备份密令。服务器无法找回你的密令；没有对应密令，加密备份无法解锁。首次备份后，建议在另一个浏览器中实际恢复并核对内容。
        </p>
      </details>
      <div className="avatar-reliability-card__actions">
        <button
          type="button"
          className="avatar-reliability-card__primary-action"
          onClick={() => void exportBackup()}
          disabled={busy}
        >
          生成备份
        </button>
        <button
          type="button"
          className="avatar-reliability-card__secondary-action"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          恢复备份
        </button>
      </div>
      <details className="avatar-reliability-card__recovery">
        <summary>遇到无法读取的记录？</summary>
        <p>仅在普通备份失败时，生成一份跳过无法读取记录的可抢救备份。</p>
        <button
          type="button"
          className="avatar-reliability-card__text-action"
          onClick={() => void exportRecoverableBackup()}
          disabled={busy}
        >
          生成可抢救备份
        </button>
      </details>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          setRestoreFile(event.target.files?.[0] ?? null);
          setInspection(null);
          setDrill(null);
          setRestoreResult(null);
          setReplaceConfirmed(false);
          setRestoreMode('merge');
          setError('');
          event.currentTarget.value = '';
        }}
      />
      {restoreFile && (
        <div className="avatar-reliability-restore">
          <p role="note">
            恢复只会修改本机权威存储。此前导出的备份文件不会被远程修改；已发送至第三方模型服务商的数据也无法撤回。请在恢复前检查预览与权限状态。
          </p>
          <div className="avatar-reliability-restore__heading">
            <span>恢复备份</span>
            <p>已选择：{restoreFile.name}</p>
          </div>
          <div className="avatar-reliability-restore__option">
            <input
              id="restore-mode-merge"
              type="radio"
              name="restore-mode"
              checked={restoreMode === 'merge'}
              onChange={() => setRestoreMode('merge')}
            />
            <label htmlFor="restore-mode-merge">
              <strong>合并恢复（推荐）</strong>
              <small>保留本机现有资料，并带回备份中的资料；同一编号但内容不同会停止恢复。</small>
            </label>
          </div>
          <div className="avatar-reliability-restore__option">
            <input
              id="restore-mode-replace"
              type="radio"
              name="restore-mode"
              checked={restoreMode === 'replace'}
              onChange={() => setRestoreMode('replace')}
            />
            <label htmlFor="restore-mode-replace">
              <strong>替换恢复</strong>
              <small>
                用备份替换当前资料。经历、规划、草稿和分身的已确认理解都会回到备份创建时刻。
              </small>
            </label>
          </div>
          <input
            value={restorePassword}
            onChange={(event) => {
              setRestorePassword(event.target.value);
              setInspection(null);
              setDrill(null);
            }}
            type="password"
            autoComplete="off"
            placeholder="若备份已加密，请输入备份密令"
            aria-label="备份密令"
          />
          <button type="button" onClick={() => void inspectBackup()} disabled={busy}>
            {busy ? '检查中…' : '检查备份'}
          </button>
          <button type="button" onClick={() => void drillRestore()} disabled={busy}>
            {busy ? '演练中…' : '隔离恢复演练'}
          </button>
          {inspection && (
            <section className="avatar-reliability-inspection" aria-label="备份检查结果">
              <p className="avatar-reliability-inspection__title">备份资料范围</p>
              {inspection.needsPassword ? (
                <p>此备份已加密。输入备份密令后可查看资料范围。</p>
              ) : (
                <>
                  <p>
                    备份创建于：
                    {inspection.exportedAt
                      ? new Date(inspection.exportedAt).toLocaleString()
                      : '未知时间'}
                  </p>
                  {inspection.contentSummary && (
                    <BackupSummary summary={inspection.contentSummary} />
                  )}
                  <p>资料与分身的已确认理解已包含。模型密钥和设备密码不会写入备份。</p>
                </>
              )}
              {!inspection.needsPassword &&
              inspection.contentSummary?.materialReferences.externalLink ? (
                <p>网页链接只保留地址；链接失效后无法由备份恢复网页内容。</p>
              ) : null}
            </section>
          )}
          {drill && (
            <section className="avatar-reliability-inspection" aria-label="隔离恢复演练结果">
              <p>
                {drill.canRestore
                  ? '演练通过：可以执行恢复。'
                  : drill.resurrectionCount > 0
                    ? '检测到旧备份中的已删除记录；默认保持删除，只有明确勾选恢复旧版本后才会继续。'
                    : '演练发现冲突：实际恢复会中止。'}
              </p>
              <p>
                将导入记录：{drill.importedCount}；演练后记录：{drill.totalAfter}
              </p>
              {drill.conflicts.length > 0 && <p>冲突：{drill.conflicts.join('；')}</p>}
              {drill.resurrectionCount > 0 && (
                <label className="avatar-reliability-restore__confirm">
                  <input
                    type="checkbox"
                    checked={resurrectionConfirmed}
                    onChange={(event) => setResurrectionConfirmed(event.target.checked)}
                  />
                  我确认恢复 {drill.resurrectionCount} 条此前已删除的旧记录
                </label>
              )}
              <p>演练不会写入当前资料库，也不会访问网页链接或网络资源。</p>
            </section>
          )}
          {restoreMode === 'replace' && (
            <label className="avatar-reliability-restore__confirm">
              <input
                type="checkbox"
                checked={replaceConfirmed}
                onChange={(event) => setReplaceConfirmed(event.target.checked)}
              />
              我确认用备份替换当前资料与分身的已确认理解
            </label>
          )}
          <button
            type="button"
            onClick={() => void restoreBackup()}
            disabled={
              busy ||
              !inspection ||
              inspection.needsPassword ||
              (restoreMode === 'replace' && !replaceConfirmed) ||
              (Boolean(drill?.resurrectionCount) && !resurrectionConfirmed)
            }
          >
            {busy ? '处理中…' : restoreMode === 'merge' ? '合并恢复' : '替换恢复'}
          </button>
        </div>
      )}
      {restoreResult && (
        <section className="avatar-reliability-inspection" aria-label="恢复结果">
          <p className="avatar-reliability-inspection__title">
            已完成{restoreResult.mode === 'merge' ? '合并' : '替换'}恢复
          </p>
          <p>现在共有：</p>
          <BackupSummary summary={restoreResult.restored} includeMaterials={false} />
        </section>
      )}
      {error && (
        <p className="avatar-reliability-card__error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}

function BackupSummary({
  summary,
  includeMaterials = true,
}: {
  summary: VaultBackupContentSummary;
  includeMaterials?: boolean;
}) {
  return (
    <>
      <p>
        经历 {summary.entries} · 补充 {summary.supplements}
        {includeMaterials
          ? ` · 素材 ${summary.materials}（其中 ${summary.portableMaterials} 项已随备份保存）`
          : ''}
      </p>
      <p>
        愿景 {summary.visions} · 目标 {summary.goals} · 行动 {summary.actions}
      </p>
      <p>
        已确认记忆 {summary.confirmedMemories} · 对话 {summary.conversations}
      </p>
      <p>未完成草稿：{summary.hasDraft ? '包含' : '未包含'}</p>
    </>
  );
}

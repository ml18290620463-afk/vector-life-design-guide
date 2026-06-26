import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { BACKUP_REMINDER_DAYS } from '../services/appSettings';

interface BackupReminderBannerProps {
  /** When false, the banner renders nothing. */
  active: boolean;
  /** Days since the last successful export, or `null` when the user has
   *  never exported (we then surface the "never exported" copy variant). */
  daysSinceBackup: number | null;
  theme: Theme;
  t: TranslationDictionary;
  /** Click handler for the inline "open settings" call-to-action. */
  onOpenSettings: () => void;
}

/**
 * Amber "your last Star Map backup is overdue" banner shown above the
 * vault content. Pure presentation; the upstream `useBackupReminder`
 * hook decides whether to render it (`active` flag) and what date to
 * cite. Pulled out of `Dashboard.tsx` as part of Phase 2 §2.h.
 */
export const BackupReminderBanner: React.FC<BackupReminderBannerProps> = ({
  active,
  daysSinceBackup,
  theme,
  t,
  onOpenSettings,
}) => {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 flex items-start gap-3 px-4 py-3 rounded border text-[12px] leading-relaxed ${
        theme === 'light'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
      }`}
    >
      <AlertTriangle className="w-4 h-4 mt-[2px] flex-shrink-0" />
      <div className="flex-1">
        <strong className="font-mono uppercase tracking-widest text-[10px] block mb-1">
          {t.backupReminderTitle ?? 'Backup overdue'}
        </strong>
        <span>
          {(daysSinceBackup == null
            ? (t.backupReminderNever ??
              'You have never exported a backup. Open Settings → Export Star Map to make one.')
            : (
                t.backupReminderBody ??
                'Last backup was {days} days ago. Export your Star Map again to keep your local-only vault safe.'
              ).replace('{days}', String(daysSinceBackup))
          ).replace('{threshold}', String(BACKUP_REMINDER_DAYS))}
        </span>
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        className={`text-[10px] font-mono uppercase tracking-widest underline underline-offset-4 ${theme === 'light' ? 'hover:text-amber-700' : 'hover:text-amber-300'}`}
      >
        {t.backupReminderAction ?? 'Open settings'}
      </button>
    </div>
  );
};

import React from 'react';
import { Database, FileText, Music, Plus, Video } from 'lucide-react';
import type { Attachment, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface SettingsMaterialSectionProps {
  theme: Theme;
  t: TranslationDictionary;
  /** Hidden `<input type="file">` ref the upload button triggers. */
  mediaInputRef: React.RefObject<HTMLInputElement | null>;
  /** Whether the parent's `useAttachmentUpload` is mid-stage. */
  isUploading: boolean;
  /** Currently staged attachment (preview card). `null` when nothing
   *  is staged. */
  stagedMaterial: Attachment | null;
  setStagedMaterial: (value: Attachment | null) => void;
  /** Promote the staged attachment into a real diary entry. */
  onCreateMaterialEntry: (material: Attachment, isArchived: boolean) => void;
  /** Surface a transient success message (e.g. "material saved"). */
  onMaterialSaved: () => void;
  /** Inline error / success banners (already-localised text from the
   *  upstream `useAttachmentUpload` callbacks). */
  mediaError: string | null;
  mediaSuccess: string | null;
}

const StagedPreviewIcon: React.FC<{ type: Attachment['type'] }> = ({ type }) => {
  if (type === 'video') return <Video className="w-8 h-8" />;
  if (type === 'audio') return <Music className="w-8 h-8" />;
  return <FileText className="w-8 h-8" />;
};

/**
 * Top half of the Settings → Storage section: the "memory & tracks"
 * heading, the upload button (clicks the hidden file input the parent
 * also wires up — we just trigger via ref), the staged-material
 * preview card, and the error / success banners.
 *
 * Pulled out of `SettingsPanel.tsx` as part of Phase 2 §2.j.
 */
export const SettingsMaterialSection: React.FC<SettingsMaterialSectionProps> = ({
  theme,
  t,
  mediaInputRef,
  isUploading,
  stagedMaterial,
  setStagedMaterial,
  onCreateMaterialEntry,
  onMaterialSaved,
  mediaError,
  mediaSuccess,
}) => (
  <div
    className={`rounded-2xl border p-6 space-y-6 transition-all ${theme === 'light' ? 'bg-white/80 border-slate-100 shadow-sm' : 'bg-black/40 border-cyan-900/20'}`}
  >
    <div className="flex items-center gap-2">
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${theme === 'light' ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-950/50 text-cyan-400'}`}
      >
        <Database className="w-5 h-5" />
      </span>
      <h4
        className={`text-sm font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-cyan-200'}`}
      >
        {t.memAndTracks}
      </h4>
    </div>

    <button
      onClick={() => mediaInputRef.current?.click()}
      disabled={isUploading}
      className={`w-full py-4 border rounded-xl flex items-center justify-center gap-3 text-sm font-bold transition-all ${theme === 'light' ? 'bg-white border-cyan-100 text-cyan-600 shadow-sm hover:shadow-md' : 'bg-cyan-950/10 border-cyan-900/30 text-cyan-400'} ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
    >
      <Plus className={`w-4 h-4 ${isUploading ? 'animate-spin' : ''}`} />{' '}
      {isUploading ? t.isUploading : t.loadSupply}
    </button>

    {stagedMaterial && (
      <div
        className={`p-4 rounded-xl border animate-in zoom-in-95 duration-300 ${theme === 'light' ? 'bg-cyan-50/50 border-cyan-100' : 'bg-cyan-950/20 border-cyan-900/50'}`}
      >
        <div className="flex items-center gap-4">
          {stagedMaterial.type === 'image' ? (
            <img
              src={stagedMaterial.data}
              className="w-16 h-16 rounded-lg object-cover border border-cyan-500/20"
              alt={stagedMaterial.name || 'preview'}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-cyan-950/30 flex items-center justify-center text-cyan-400">
              <StagedPreviewIcon type={stagedMaterial.type} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm font-bold truncate ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}
            >
              {stagedMaterial.name}
            </div>
            <div className="text-[10px] text-cyan-600 font-mono">STAGED_READY</div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                onCreateMaterialEntry(stagedMaterial, false);
                setStagedMaterial(null);
                onMaterialSaved();
              }}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-[10px] font-bold rounded-lg transition-all"
            >
              {t.save}
            </button>
            <button
              onClick={() => setStagedMaterial(null)}
              className={`text-[10px] font-bold ${theme === 'light' ? 'text-slate-400' : 'text-cyan-800'}`}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      </div>
    )}

    {mediaError && (
      <div
        role="alert"
        className="text-[10px] p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 font-mono animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.1)]"
      >
        {mediaError}
      </div>
    )}
    {mediaSuccess && (
      <div
        role="status"
        className="text-[10px] p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 font-mono"
      >
        {mediaSuccess}
      </div>
    )}
  </div>
);

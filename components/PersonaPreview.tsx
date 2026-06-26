import React, { useId, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { CustomPersona } from '../types';
import { CyberButton } from './CyberButton';
import { PERSONA_LIMITS } from '../services/personaService';

interface PersonaPreviewProps {
  persona: CustomPersona;
  theme: Theme;
  t: TranslationDictionary;
  /** Saving the persona is the consumer's responsibility (it owns
   *  the `useCustomPersonas.addPersona` handle). The preview surface
   *  hands back the (possibly edited) persona on confirmation. */
  onConfirm: (persona: CustomPersona) => Promise<void> | void;
  /** Re-run the wizard from step 0. */
  onRetry: () => void;
}

/**
 * Phase 4 Week 2 Day 3 — `PersonaPreview`
 *
 * Renders the AI-generated persona triple (`name` /`description` /
 * `systemPrompt`) with editable inputs. The user can:
 *   - tweak any of the three fields before saving (we ship LLM
 *     output, not commit it sight unseen)
 *   - click "Save" to persist the edited persona
 *   - click "Try again" to reset the wizard and re-prompt
 *
 * Privacy posture: the system prompt is rendered in a read-then-edit
 * textarea so the user can audit it for accidentally-leaked PII
 * before the persona joins their guiding star list.
 */
export const PersonaPreview: React.FC<PersonaPreviewProps> = ({
  persona,
  theme,
  t,
  onConfirm,
  onRetry,
}) => {
  const [editable, setEditable] = useState<CustomPersona>(persona);
  const [saving, setSaving] = useState(false);

  const nameId = useId();
  const descriptionId = useId();
  const promptId = useId();

  const update = (patch: Partial<CustomPersona>) => {
    setEditable((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onConfirm(editable);
    } finally {
      setSaving(false);
    }
  };

  const subtle = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';
  const inputClass = `w-full p-2 rounded-md border ${theme === 'light' ? 'bg-white border-slate-300 text-vector-ink-strong placeholder-vector-slate-soft' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100 placeholder-vector-slate-chrome'} focus:outline-none focus:border-vector-cyan-neon/60`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
        <h2 className="text-xl font-bold tracking-wide">
          {t.personaPreviewHeadline ?? 'Review your new guiding star'}
        </h2>
      </div>
      <p className={`text-xs leading-relaxed ${subtle}`}>
        {t.personaPreviewSubtitle ??
          'AI drafted a system prompt based on your answers. Edit anything that feels off — your changes are saved alongside your persona.'}
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-xs font-bold uppercase tracking-widest">
          {t.personaPreviewName ?? 'Name'}
        </label>
        <input
          id={nameId}
          type="text"
          value={editable.name}
          onChange={(e) => update({ name: e.target.value })}
          maxLength={PERSONA_LIMITS.name}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={descriptionId} className="text-xs font-bold uppercase tracking-widest">
          {t.personaPreviewDescription ?? 'Tagline'}
        </label>
        <input
          id={descriptionId}
          type="text"
          value={editable.description ?? ''}
          onChange={(e) => update({ description: e.target.value })}
          maxLength={PERSONA_LIMITS.description}
          className={inputClass}
          placeholder={t.personaPreviewDescriptionPlaceholder ?? '(optional)'}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={promptId} className="text-xs font-bold uppercase tracking-widest">
          {t.personaPreviewPrompt ?? 'System prompt'}
        </label>
        <textarea
          id={promptId}
          rows={8}
          value={editable.systemPrompt}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          maxLength={PERSONA_LIMITS.systemPrompt}
          className={`${inputClass} font-mono text-[12px] leading-relaxed`}
          data-testid="persona-preview-prompt"
        />
        <div className={`text-[10px] font-mono text-right ${subtle}`} aria-live="polite">
          {editable.systemPrompt.length} / {PERSONA_LIMITS.systemPrompt}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4">
        <button
          type="button"
          onClick={onRetry}
          disabled={saving}
          className={`flex items-center gap-1 text-[11px] uppercase tracking-widest hover:text-vector-cyan-neon ${subtle} disabled:opacity-30`}
          aria-label={t.personaPreviewRetry ?? 'Try again'}
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {t.personaPreviewRetry ?? 'Try again'}
        </button>
        <CyberButton
          onClick={handleSave}
          theme={theme}
          disabled={saving || !editable.name.trim() || !editable.systemPrompt.trim()}
          aria-label={t.personaPreviewSave ?? 'Save persona'}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" aria-hidden="true" />
          {saving
            ? (t.personaPreviewSaving ?? 'Saving\u2026')
            : (t.personaPreviewSave ?? 'Save persona')}
        </CyberButton>
      </div>
    </div>
  );
};

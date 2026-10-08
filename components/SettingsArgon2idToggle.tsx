import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { SecurityService } from '../services/securityService';

interface SettingsArgon2idToggleProps {
  theme: Theme;
  t: TranslationDictionary;
}

/**
 * W2.2 — Settings → Security toggle for the Phase 4 Argon2id minter.
 *
 * Self-contained: reads / writes directly through
 * `SecurityService.{is,set}Argon2idMinterEnabled`. No props are
 * needed beyond theme + translations because the underlying
 * persistence is `localStorage`, not React state — and re-mounting
 * the form (which the parent does on every Settings open) is the
 * trigger to re-read.
 *
 * UX contract:
 *   - One single toggle: "Use Argon2id for new passwords (experimental)".
 *     The companion "verifier" branch turns on automatically when the
 *     user opts in (enforced in `setArgon2idMinterEnabled`).
 *   - Help text explains the effect is forward-only — existing PBKDF2
 *     hashes keep working, and turning the toggle off does NOT roll
 *     back any hash that was already minted as Argon2id (since the
 *     verifier stays on).
 *   - Toggle uses `<button role="switch" aria-checked>` so screen
 *     readers announce the state change verbatim.
 */
export const SettingsArgon2idToggle: React.FC<SettingsArgon2idToggleProps> = ({ theme, t }) => {
  const [enabled, setEnabled] = useState(() => SecurityService.isArgon2idMinterEnabled());

  // Keep the local mirror in sync if some other surface flips the
  // flag while this panel is open (e.g. a future ⌘K command palette).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'vector_argon2_minter' || event.key === 'vector_argon2_verify') {
        setEnabled(SecurityService.isArgon2idMinterEnabled());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const onToggle = () => {
    const next = !enabled;
    SecurityService.setArgon2idMinterEnabled(next);
    setEnabled(SecurityService.isArgon2idMinterEnabled());
  };

  const labelOn = t.argon2ToggleEnabled || 'Enabled (experimental)';
  const labelOff = t.argon2ToggleDisabled || 'Disabled (PBKDF2 default)';
  const title = t.argon2ToggleTitle || 'Use Argon2id for new passwords';
  const description =
    t.argon2ToggleHint ||
    'Argon2id is memory-hard and resists GPU/ASIC attacks. Existing passwords keep working unchanged; only NEW passwords are minted under the new algorithm. The first unlock after the change has a small wasm-load cost (~100 ms).';

  return (
    <div
      className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-cyan-50/50 border-cyan-100' : 'bg-cyan-950/15 border-cyan-900/30'}`}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck
          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${enabled ? 'text-cyan-500' : theme === 'light' ? 'text-slate-300' : 'text-cyan-900'}`}
          aria-hidden
        />
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div
              className={`text-[12px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-700' : 'text-cyan-200'}`}
            >
              {title}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={title}
              data-testid="argon2id-toggle"
              onClick={onToggle}
              className={`relative w-11 h-6 rounded-full border transition-colors ${
                enabled
                  ? 'bg-cyan-500 border-cyan-400'
                  : theme === 'light'
                    ? 'bg-slate-200 border-slate-300'
                    : 'bg-black/60 border-cyan-900/40'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
                aria-hidden
              />
            </button>
          </div>
          <div
            className={`text-[10px] font-mono ${enabled ? 'text-cyan-500' : theme === 'light' ? 'text-slate-400' : 'text-cyan-700'}`}
          >
            {enabled ? labelOn : labelOff}
          </div>
          <p
            className={`text-[10px] leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-cyan-700'}`}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

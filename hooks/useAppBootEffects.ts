import { useEffect } from 'react';
import { TRANSLATIONS } from '../constants';
import type { Language } from '../types';
import { getPreviewMode } from '../lib/previewMode';
import { SecurityService } from '../services/securityService';

type UseAppBootEffectsOptions = {
  language: Language;
  setCurrentUser: (currentUser: string) => void;
};

export const useAppBootEffects = ({ language, setCurrentUser }: UseAppBootEffectsOptions) => {
  useEffect(() => {
    setCurrentUser(TRANSLATIONS[language].localUser);
  }, [language, setCurrentUser]);

  useEffect(() => {
    const mode = getPreviewMode();
    document.documentElement.classList.toggle('vector-force-mobile', mode === 'mobile');
    document.documentElement.classList.toggle('vector-force-web', mode === 'web');

    return () => {
      document.documentElement.classList.remove('vector-force-mobile', 'vector-force-web');
    };
  }, []);

  useEffect(() => {
    const flipped = SecurityService.applyArgon2idDefaults();
    if (flipped) {
      console.info('Argon2id defaults applied (Phase 4.5 §C rollout).');
    }
  }, []);
};

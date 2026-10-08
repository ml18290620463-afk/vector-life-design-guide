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
    const mobileViewport = window.matchMedia('(max-width: 767px)');
    const syncExperienceClass = () => {
      const useMobileTheme = mode === 'mobile' || (mode !== 'web' && mobileViewport.matches);
      document.documentElement.classList.toggle('vector-force-mobile', useMobileTheme);
      document.documentElement.classList.toggle('vector-force-web', !useMobileTheme);
    };

    syncExperienceClass();
    mobileViewport.addEventListener('change', syncExperienceClass);

    return () => {
      mobileViewport.removeEventListener('change', syncExperienceClass);
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

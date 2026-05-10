import { create } from 'zustand';
import { AppState, DiaryEntry, Language, Theme } from '../types';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString, setStoredString } from '../services/browserStorage';
import { canTransitionAppState } from '../services/appStateMachine';

interface AppStore {
  appState: AppState;
  language: Language;
  theme: Theme;
  currentUser: string | null;
  userId: string | undefined;
  masterPassword: string | null;
  isUnlocked: boolean;
  selectedEntry: DiaryEntry | null;
  setAppState: (state: AppState) => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  setCurrentUser: (user: string | null) => void;
  setUserId: (userId: string | undefined) => void;
  setMasterPassword: (password: string | null) => void;
  setIsUnlocked: (isUnlocked: boolean) => void;
  setSelectedEntry: (entry: DiaryEntry | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  appState: AppState.COVER,
  language: 'zh',
  theme: (getStoredString(AppStorageKeys.theme) as Theme) || 'dark',
  currentUser: '用户名',
  userId: 'local-user',
  masterPassword: null,
  isUnlocked: false,
  selectedEntry: null,
  setAppState: (state) => {
    const currentState = get().appState;
    if (!canTransitionAppState(currentState, state)) {
      console.warn(`Blocked invalid app state transition: ${currentState} -> ${state}`);
      return;
    }
    set({ appState: state });
  },
  setLanguage: (lang) => set({ language: lang }),
  setTheme: (theme) => {
    setStoredString(AppStorageKeys.theme, theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    set({ theme });
  },
  setCurrentUser: (currentUser) => set({ currentUser }),
  setUserId: (userId) => set({ userId }),
  setMasterPassword: (masterPassword) => set({ masterPassword }),
  setIsUnlocked: (isUnlocked) => set({ isUnlocked }),
  setSelectedEntry: (selectedEntry) => set({ selectedEntry }),
}));

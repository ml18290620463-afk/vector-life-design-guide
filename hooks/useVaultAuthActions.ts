import { useCallback } from 'react';
import { AppState } from '../types';
import { SecurityService } from '../services/securityService';

type UseVaultAuthActionsOptions = {
  clearPasswordHash: () => Promise<void>;
  ensureIdentity: (password: string, warningContext?: string) => Promise<unknown>;
  enterPendingOrPastMain: () => void;
  passwordHash: string | null;
  saveGuidingStars: (guidingStars: string[]) => Promise<void>;
  savePasswordHash: (hash: string) => Promise<void>;
  savePasswordSalt: (salt: string) => Promise<void>;
  saveSelectedStars: (selectedStars: string[]) => Promise<void>;
  setAppState: (state: AppState) => void;
  setIsUnlocked: (isUnlocked: boolean) => void;
  setMasterPassword: (password: string | null) => void;
  wipeData: () => Promise<void>;
};

const persistPassword = async (
  password: string,
  savePasswordHash: (hash: string) => Promise<void>,
  savePasswordSalt: (salt: string) => Promise<void>,
) => {
  const saltArray = window.crypto.getRandomValues(new Uint8Array(32));
  const salt = btoa(String.fromCharCode(...saltArray));
  SecurityService.wipeSensitive(saltArray);
  const hash = await SecurityService.hashPassword(password, salt);
  await savePasswordSalt(salt);
  await savePasswordHash(hash);
};

export const useVaultAuthActions = ({
  clearPasswordHash,
  ensureIdentity,
  enterPendingOrPastMain,
  passwordHash,
  saveGuidingStars,
  savePasswordHash,
  savePasswordSalt,
  saveSelectedStars,
  setAppState,
  setIsUnlocked,
  setMasterPassword,
  wipeData,
}: UseVaultAuthActionsOptions) => {
  const handleStartFromCover = useCallback(() => {
    setAppState(passwordHash ? AppState.LOGIN : AppState.ONBOARDING);
  }, [passwordHash, setAppState]);

  const handleSetPassword = useCallback(
    async (password: string) => {
      await persistPassword(password, savePasswordHash, savePasswordSalt);
      setMasterPassword(password);
      setIsUnlocked(true);
    },
    [savePasswordHash, savePasswordSalt, setIsUnlocked, setMasterPassword],
  );

  const handleOnboardingComplete = useCallback(
    async (password: string, directory: string[], selection: string[]) => {
      setMasterPassword(password);
      setIsUnlocked(true);
      enterPendingOrPastMain();

      void (async () => {
        try {
          await persistPassword(password, savePasswordHash, savePasswordSalt);
          await saveGuidingStars(directory);
          await saveSelectedStars(selection);
        } catch (err) {
          console.warn('App: onboarding persistence failed after entering', err);
        }
      })();

      void ensureIdentity(password);
    },
    [
      ensureIdentity,
      enterPendingOrPastMain,
      saveGuidingStars,
      savePasswordHash,
      savePasswordSalt,
      saveSelectedStars,
      setIsUnlocked,
      setMasterPassword,
    ],
  );

  const handleReturningUserUnlock = useCallback(
    (password: string) => {
      setMasterPassword(password);
      setIsUnlocked(true);
      enterPendingOrPastMain();
      void ensureIdentity(password);
    },
    [ensureIdentity, enterPendingOrPastMain, setIsUnlocked, setMasterPassword],
  );

  const handleRecoveryPasswordReset = useCallback(
    async (password: string) => {
      await handleSetPassword(password);
      enterPendingOrPastMain();
      void ensureIdentity(password, 'ensureDeviceKeypair after recovery reset');
    },
    [ensureIdentity, enterPendingOrPastMain, handleSetPassword],
  );

  const handleClearPassword = useCallback(async () => {
    await clearPasswordHash();
    setMasterPassword(null);
    setIsUnlocked(false);
  }, [clearPasswordHash, setIsUnlocked, setMasterPassword]);

  const handleWipeData = useCallback(() => {
    setMasterPassword(null);
    setIsUnlocked(false);
    setAppState(AppState.COVER);
    wipeData().catch(console.error);
  }, [setAppState, setIsUnlocked, setMasterPassword, wipeData]);

  return {
    handleClearPassword,
    handleOnboardingComplete,
    handleRecoveryPasswordReset,
    handleReturningUserUnlock,
    handleSetPassword,
    handleStartFromCover,
    handleWipeData,
  };
};

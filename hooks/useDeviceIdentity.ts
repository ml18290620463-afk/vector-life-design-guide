import { useCallback, useEffect, useState } from 'react';
import {
  ensureDeviceKeypair,
  loadPublicIdentity,
  regenerateDeviceKeypair,
  unlockSecretKey,
  type DevicePublicIdentity,
} from '../services/deviceKeypair';

export const useDeviceIdentity = (masterPassword: string | null) => {
  const [deviceIdentity, setDeviceIdentity] = useState<DevicePublicIdentity | null>(null);

  useEffect(() => {
    void loadPublicIdentity().then(setDeviceIdentity).catch(() => undefined);
  }, []);

  const ensureIdentity = useCallback(async (password: string, warningContext = 'ensureDeviceKeypair') => {
    try {
      const identity = await ensureDeviceKeypair(password);
      setDeviceIdentity(identity);
      return identity;
    } catch (err) {
      console.warn(`App: ${warningContext} failed`, err);
      return null;
    }
  }, []);

  const regenerateIdentity = useCallback(async () => {
    if (!masterPassword) return;
    try {
      const identity = await regenerateDeviceKeypair(masterPassword);
      setDeviceIdentity(identity);
    } catch (err) {
      console.warn('App: regenerateDeviceKeypair failed', err);
    }
  }, [masterPassword]);

  const unlockSigningKey = useCallback(async () => {
    if (!masterPassword || !deviceIdentity) return null;
    const secret = await unlockSecretKey(masterPassword);
    if (!secret) return null;
    return { secretKey: secret, publicKey: deviceIdentity.publicKey };
  }, [deviceIdentity, masterPassword]);

  return {
    deviceIdentity,
    ensureIdentity,
    regenerateIdentity,
    unlockSigningKey,
  };
};

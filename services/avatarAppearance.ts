import {
  DEFAULT_AVATAR_APPEARANCE,
  sanitizeAvatarAppearance,
  type AvatarAppearance,
} from '../features/avatar/appearance';
import { getStoredJson, setStoredJson } from './browserStorage';

const AVATAR_APPEARANCE_KEY = 'vector:avatar:appearance:v1';

export const readAvatarAppearance = (): AvatarAppearance => {
  const stored = getStoredJson<unknown>(AVATAR_APPEARANCE_KEY);
  return stored === null ? DEFAULT_AVATAR_APPEARANCE : sanitizeAvatarAppearance(stored);
};

export const writeAvatarAppearance = (appearance: AvatarAppearance): boolean =>
  setStoredJson(AVATAR_APPEARANCE_KEY, sanitizeAvatarAppearance(appearance));

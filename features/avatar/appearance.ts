export type AvatarCoreShape = 'orb' | 'prism' | 'orbit';
export type AvatarAura = 'calm' | 'clear' | 'warm';
export type AvatarMotion = 'still' | 'alive';

export interface AvatarAppearance {
  name: string;
  shape: AvatarCoreShape;
  aura: AvatarAura;
  motion: AvatarMotion;
}

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearance = {
  name: 'VECTOR',
  shape: 'orb',
  aura: 'clear',
  motion: 'alive',
};

const SHAPES = new Set<AvatarCoreShape>(['orb', 'prism', 'orbit']);
const AURAS = new Set<AvatarAura>(['calm', 'clear', 'warm']);
const MOTIONS = new Set<AvatarMotion>(['still', 'alive']);

export const sanitizeAvatarAppearance = (value: unknown): AvatarAppearance => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_AVATAR_APPEARANCE;
  }
  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 12) : '';
  return {
    name: name || DEFAULT_AVATAR_APPEARANCE.name,
    shape: SHAPES.has(candidate.shape as AvatarCoreShape)
      ? (candidate.shape as AvatarCoreShape)
      : DEFAULT_AVATAR_APPEARANCE.shape,
    aura: AURAS.has(candidate.aura as AvatarAura)
      ? (candidate.aura as AvatarAura)
      : DEFAULT_AVATAR_APPEARANCE.aura,
    motion: MOTIONS.has(candidate.motion as AvatarMotion)
      ? (candidate.motion as AvatarMotion)
      : DEFAULT_AVATAR_APPEARANCE.motion,
  };
};

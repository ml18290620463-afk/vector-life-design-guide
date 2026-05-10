const BYTE_LENGTH = 16;

function randomHexToken(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(BYTE_LENGTH);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fall through to legacy fallback
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

export function generateSecureId(prefix?: string): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      const uuid = crypto.randomUUID();
      return prefix ? `${prefix}-${uuid}` : uuid;
    }
  } catch {
    // fall through to token fallback
  }

  const token = randomHexToken();
  return prefix ? `${prefix}-${token}` : token;
}

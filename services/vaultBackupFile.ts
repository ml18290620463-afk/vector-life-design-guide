/** Portable format: parameters travel with the file; no local credentials or plaintext metadata. */
export interface EncryptedVaultBackup {
  type: 'vector-encrypted-vault-backup';
  schemaVersion: 1;
  cipher: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}
const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array) => {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192)
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
};
const bytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const header = (file: EncryptedVaultBackup) =>
  encoder.encode(
    JSON.stringify({
      type: file.type,
      schemaVersion: file.schemaVersion,
      cipher: file.cipher,
      kdf: file.kdf,
      iterations: file.iterations,
      salt: file.salt,
      iv: file.iv,
    }),
  );
async function keyFor(password: string, file: EncryptedVaultBackup) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bytes(file.salt), iterations: file.iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export function isEncryptedVaultBackup(value: unknown): value is EncryptedVaultBackup {
  return (
    !!value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'vector-encrypted-vault-backup'
  );
}
export async function encryptVaultBackupFile(
  value: unknown,
  password: string,
): Promise<EncryptedVaultBackup> {
  if (!password) throw new Error('请先解锁资料库');
  const file: EncryptedVaultBackup = {
    type: 'vector-encrypted-vault-backup',
    schemaVersion: 1,
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 600_000,
    salt: base64(crypto.getRandomValues(new Uint8Array(16))),
    iv: base64(crypto.getRandomValues(new Uint8Array(12))),
    ciphertext: '',
  };
  const plaintext = encoder.encode(JSON.stringify(value));
  try {
    file.ciphertext = base64(
      new Uint8Array(
        await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: bytes(file.iv), additionalData: header(file) },
          await keyFor(password, file),
          plaintext,
        ),
      ),
    );
    return file;
  } finally {
    plaintext.fill(0);
  }
}
export async function decryptVaultBackupFile(
  file: EncryptedVaultBackup,
  password: string,
): Promise<unknown> {
  if (
    file.schemaVersion !== 1 ||
    file.cipher !== 'AES-256-GCM' ||
    file.kdf !== 'PBKDF2-SHA256' ||
    file.iterations !== 600_000
  )
    throw new Error('不支持的加密备份版本或参数');
  try {
    if (
      !password ||
      typeof file.ciphertext !== 'string' ||
      bytes(file.salt).length !== 16 ||
      bytes(file.iv).length !== 12 ||
      bytes(file.ciphertext).length < 16
    )
      throw new Error('Invalid envelope');
    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes(file.iv), additionalData: header(file) },
        await keyFor(password, file),
        bytes(file.ciphertext),
      ),
    );
    try {
      return JSON.parse(new TextDecoder().decode(plaintext));
    } finally {
      plaintext.fill(0);
    }
  } catch {
    throw new Error('备份密码不正确，或文件已损坏。未导入任何数据。');
  }
}

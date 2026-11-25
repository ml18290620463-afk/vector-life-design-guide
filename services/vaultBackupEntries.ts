import type { DiaryEntry } from '../types';
import { SecurityService } from './securityService';
import { VaultLockedError } from './vaultTransaction';
export async function plaintextEntries(
  entries: DiaryEntry[],
  password: string | null,
): Promise<DiaryEntry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const decryptContent = async (content: string, encrypted?: boolean) => {
        if (!encrypted) return content;
        if (!password) throw new VaultLockedError();
        return SecurityService.decrypt(content, password);
      };
      return {
        ...entry,
        content: await decryptContent(entry.content, entry.isEncrypted),
        isEncrypted: false,
        supplements: entry.supplements
          ? await Promise.all(
              entry.supplements.map(async (supplement) => ({
                ...supplement,
                content: await decryptContent(supplement.content, supplement.isEncrypted),
                isEncrypted: false,
              })),
            )
          : undefined,
      };
    }),
  );
}

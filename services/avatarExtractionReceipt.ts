import type { AvatarFactKind } from '../server/avatarFactExtraction';

/** Ephemeral attestations issued only after the extraction endpoint and local quote checks.
 * Cloning, editing or importing a candidate cannot manufacture server verification. */
export interface AvatarExtractionEvidence {
  sourceId: string;
  userMessageIndex: number;
  verbatimQuote: string;
  sourceOccurredAt: string;
}

export interface AvatarExtractionReceipt {
  action?: 'create_new' | 'reinforce_existing' | 'propose_supersede';
  targetObjectId?: string;
  revisionReason?: string;
  replacesReferenceId?: string;
  kind: AvatarFactKind;
  aiPrivacyToken: string;
  statement: string;
  evidenceAnchors: AvatarExtractionEvidence[];
}

const receipts = new WeakMap<object, AvatarExtractionReceipt>();

/** Called by the API adapter only, after its server response passes quote validation. */
export function attestAvatarExtraction<T extends AvatarExtractionReceipt>(candidate: T): T {
  receipts.set(candidate, structuredClone(candidate));
  return candidate;
}

export function readAvatarExtractionReceipt(candidate: object): AvatarExtractionReceipt {
  const receipt = receipts.get(candidate);
  if (!receipt) throw new Error('缺少经过服务端核验的抽取结果，请重新提炼');
  return structuredClone(receipt);
}

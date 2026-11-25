import type { AvatarExtractionCandidate } from '../features/avatar/types';

/** Ephemeral proof of an unchanged response from the existing growth endpoint. */
const receipts = new WeakMap<object, { token: string; candidate: AvatarExtractionCandidate }>();
export function attestExperienceCandidate(candidate: AvatarExtractionCandidate, token: string) {
  receipts.set(candidate, { token, candidate: structuredClone(candidate) });
}
export function readExperienceCandidateReceipt(candidate: object) {
  const receipt = receipts.get(candidate);
  if (!receipt) throw new Error('缺少服务端核验的经历提炼结果');
  return structuredClone(receipt);
}

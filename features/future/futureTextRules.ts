export const normalizeVisionText = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, '');

const bigrams = (text: string) => {
  if (text.length < 2) return new Set([text]);
  return new Set(
    Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)),
  );
};

/** A display-only duplicate signal; it never blocks saving a user's vision. */
export const visionSimilarity = (left: string, right: string) => {
  const a = normalizeVisionText(left);
  const b = normalizeVisionText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 6 && longer.includes(shorter) && shorter.length / longer.length >= 0.65)
    return 0.9;
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  const overlap = [...aPairs].filter((pair) => bPairs.has(pair)).length;
  return (2 * overlap) / (aPairs.size + bPairs.size);
};

export const readableDate = (value?: string) => (value ? value.replaceAll('-', '.') : '未设日期');

const updatedAt = (value: { updatedAt?: number; createdAt: number }) =>
  value.updatedAt ?? value.createdAt;
export const newestFirst = <T extends { updatedAt?: number; createdAt: number }>(values: T[]) =>
  [...values].sort((left, right) => updatedAt(right) - updatedAt(left));
